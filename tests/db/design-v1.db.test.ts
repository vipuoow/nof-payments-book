import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createGroupInvite, createServiceInvite } from "@/auth/groups";
import { acceptInvite, getInviteStatus } from "@/auth/invites";
import { sha256Hex } from "@/lib/hash";
import { loadSetup } from "@/ledger/setup";
import {
  adminClient, createAuthOnlyUser, createLoneUser, issueIngestToken, makeOperator, type TestUser,
} from "../helpers/db";

const admin = adminClient();

function expectOk<T>(r: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}

let operator: TestUser;
const setMaxUsers = (value: number) => admin.from("app_settings").update({ value }).eq("key", "max_users");

beforeAll(async () => {
  await setMaxUsers(1_000_000);
  operator = await createLoneUser("dv1-operator");
  await makeOperator(operator.userId);
});
afterAll(async () => { await setMaxUsers(30); });

async function serviceMember(label: string) {
  const user = await createAuthOnlyUser(label);
  const { token } = expectOk(await createServiceInvite(operator.client));
  expectOk(await acceptInvite(user.client, token, `구글 ${label}`));
  return user;
}

async function displayName(userId: string) {
  const { data } = await admin.from("profiles").select("display_name").eq("user_id", userId).single();
  return data?.display_name;
}

describe("가계부 만들기: 내 닉네임", () => {
  it("만들면서 내 닉네임을 저장한다", async () => {
    const owner = await serviceMember("dv1-make");
    expectOk(await createGroup(owner.client, "  남편 "));
    expect(await displayName(owner.userId)).toBe("남편");
  });

  it("닉네임이 비었거나 10자를 넘으면 만들지 않는다", async () => {
    const owner = await serviceMember("dv1-bad");
    expect(await createGroup(owner.client, "   ")).toEqual({ ok: false, reason: "name_required" });
    expect(await createGroup(owner.client, "열한글자닉네임입니다요")).toEqual({ ok: false, reason: "name_too_long" });
    const { count } = await admin.from("group_members").select("*", { count: "exact", head: true }).eq("user_id", owner.userId);
    expect(count).toBe(0);
  });
});

describe("파트너 초대: 가족 닉네임", () => {
  it("초대한 닉네임으로 들어오고, 초대 상태에 닉네임이 보인다", async () => {
    const owner = await serviceMember("dv1-inv");
    expectOk(await createGroup(owner.client, "남편"));
    const { token } = expectOk(await createGroupInvite(owner.client, "아내"));
    expect(await getInviteStatus(admin, token)).toEqual({ status: "valid", kind: "group", inviterName: "남편", inviteeName: "아내" });

    const spouse = await createAuthOnlyUser("dv1-spouse");
    expectOk(await acceptInvite(spouse.client, token, "구글 이름"));
    expect(await displayName(spouse.userId)).toBe("아내");
  });

  it("이미 프로필이 있는 사람도 초대 닉네임으로 바뀐다", async () => {
    const owner = await serviceMember("dv1-inv2");
    expectOk(await createGroup(owner.client, "남편"));
    const { token } = expectOk(await createGroupInvite(owner.client, "여보"));
    const existing = await createLoneUser("dv1-existing");
    expectOk(await acceptInvite(existing.client, token, "예전 이름"));
    expect(await displayName(existing.userId)).toBe("여보");
  });

  it("닉네임이 비면 링크를 만들지 않는다", async () => {
    const owner = await serviceMember("dv1-inv3");
    expectOk(await createGroup(owner.client, "남편"));
    expect(await createGroupInvite(owner.client, " ")).toEqual({ ok: false, reason: "name_required" });
  });

  it("새 링크를 만들면 쓰지 않은 이전 링크는 취소된다", async () => {
    const owner = await serviceMember("dv1-renew");
    expectOk(await createGroup(owner.client, "남편"));
    const first = expectOk(await createGroupInvite(owner.client, "아내")).token;
    expectOk(await createGroupInvite(owner.client, "아내"));
    const user = await createAuthOnlyUser("dv1-late");
    expect(await acceptInvite(user.client, first, "늦음")).toEqual({ ok: false, reason: "invite_revoked" });
  });

  it("닉네임 없이 만든 예전 초대는 넘긴 이름으로 들어온다", async () => {
    const owner = await serviceMember("dv1-legacy");
    const groupId = expectOk(await createGroup(owner.client, "남편"));
    const token = `legacy-${groupId}`;
    await admin.from("group_invites").insert({
      group_id: groupId, token_hash: sha256Hex(token), created_by: owner.userId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const user = await createAuthOnlyUser("dv1-legacy-user");
    expectOk(await acceptInvite(user.client, token, "구글 이름"));
    expect(await displayName(user.userId)).toBe("구글 이름");
  });
});

describe("처음 홈 상태", () => {
  it("연결·한도·인원·기다리는 초대를 알려 준다", async () => {
    const owner = await serviceMember("dv1-setup");
    const groupId = expectOk(await createGroup(owner.client, "남편"));
    expect(await loadSetup(owner.client)).toEqual({
      anyConnected: false, connectedName: null, meConnected: false, hasTotalLimit: false, memberCount: 1, pendingInvite: null,
    });

    const { expiresAt } = expectOk(await createGroupInvite(owner.client, "아내"));
    const spouse = await createAuthOnlyUser("dv1-setup-spouse");
    const s1 = await loadSetup(owner.client);
    expect(s1.pendingInvite).toEqual({ name: "아내", expiresAt: new Date(expiresAt).toISOString(), expired: false });
    void spouse;

    // 연결 코드만 만든 것은 연결이 아니다. 문자가 한 번이라도 와야 연결이다.
    await issueIngestToken(owner.userId);
    expect((await loadSetup(owner.client)).anyConnected).toBe(false);
    await admin.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", owner.userId);
    const s2 = await loadSetup(owner.client);
    expect(s2.anyConnected).toBe(true);
    expect(s2.meConnected).toBe(true);

    await admin.from("budgets").insert({ group_id: groupId, category_id: null, month: "2026-10-01", amount: 2_500_000 });
    expect((await loadSetup(owner.client)).hasTotalLimit).toBe(true);
  });

  it("파트너만 연결되면 나는 연결 전으로 보인다", async () => {
    const owner = await serviceMember("dv1-partner");
    expectOk(await createGroup(owner.client, "남편"));
    const { token } = expectOk(await createGroupInvite(owner.client, "아내"));
    const spouse = await createAuthOnlyUser("dv1-partner-spouse");
    expectOk(await acceptInvite(spouse.client, token, "구글"));
    await issueIngestToken(spouse.userId);
    await admin.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", spouse.userId);

    const s = await loadSetup(owner.client);
    expect(s).toMatchObject({ anyConnected: true, connectedName: "아내", meConnected: false, memberCount: 2, pendingInvite: null });
  });

  it("폐기한 기기는 연결로 치지 않는다", async () => {
    const owner = await serviceMember("dv1-revoked");
    expectOk(await createGroup(owner.client, "남편"));
    await issueIngestToken(owner.userId);
    await admin.from("ingest_tokens")
      .update({ last_used_at: new Date().toISOString(), revoked_at: new Date().toISOString() })
      .eq("user_id", owner.userId);
    expect((await loadSetup(owner.client)).anyConnected).toBe(false);
  });

  it("만료된 초대는 expired로 알려 준다", async () => {
    const owner = await serviceMember("dv1-expired");
    expectOk(await createGroup(owner.client, "남편"));
    expectOk(await createGroupInvite(owner.client, "아내"));
    await admin.from("group_invites").update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("created_by", owner.userId);
    expect((await loadSetup(owner.client)).pendingInvite).toMatchObject({ name: "아내", expired: true });
  });
});
