import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveIngestToken } from "@/ingest/auth";
import {
  createGroup, createGroupInvite, createServiceInvite, issueIngestToken, revokeGroupInvite, revokeIngestToken,
} from "@/auth/groups";
import { acceptInvite, getInviteStatus } from "@/auth/invites";
import { sha256Hex } from "@/lib/hash";
import {
  adminClient, createAuthOnlyUser, createGroupFixture, createLoneUser, makeOperator, type TestUser,
} from "../helpers/db";

const admin = adminClient();

function expectOk<T>(r: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}

let operator: TestUser;

// 테스트 DB에는 다른 테스트 파일이 만든 프로필이 쌓여 있으므로, 이 파일 동안만 서비스 인원 제한을 넉넉히 둔다.
const TEST_MAX_USERS = 1_000_000;
const setMaxUsers = (value: number) => admin.from("app_settings").update({ value }).eq("key", "max_users");

beforeAll(async () => {
  await setMaxUsers(TEST_MAX_USERS);
  operator = await createLoneUser("operator");
  await makeOperator(operator.userId);
});

afterAll(async () => {
  await setMaxUsers(30);
});

/** 서비스 초대로 가입해 그룹 생성 권한을 가진 사용자 */
async function serviceMember(label: string) {
  const user = await createAuthOnlyUser(label);
  const { token } = expectOk(await createServiceInvite(operator.client));
  expectOk(await acceptInvite(user.client, token, label));
  return user;
}

/** 그룹장 1명만 있는 그룹 */
async function ownerWithGroup(label: string) {
  const owner = await serviceMember(label);
  const groupId = expectOk(await createGroup(owner.client));
  return { owner, groupId };
}

describe("서비스 초대", () => {
  it("운영자만 발급할 수 있다", async () => {
    const normal = await createLoneUser("normal");
    expect(await createServiceInvite(normal.client)).toEqual({ ok: false, reason: "not_allowed" });
    const { token, expiresAt } = expectOk(await createServiceInvite(operator.client));
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("수락하면 프로필이 생기고 그룹 생성 권한을 받는다. 재사용은 거부", async () => {
    const user = await createAuthOnlyUser("svc");
    const { token } = expectOk(await createServiceInvite(operator.client));
    expect(await getInviteStatus(admin, token)).toEqual({ status: "valid", kind: "service", inviterName: null });

    expect(await acceptInvite(user.client, token, "  새사람 ")).toEqual({ ok: true, value: { kind: "service", groupId: null } });
    const { data } = await admin.from("profiles").select("display_name, can_create_group").eq("user_id", user.userId).single();
    expect(data).toEqual({ display_name: "새사람", can_create_group: true });

    const other = await createAuthOnlyUser("svc2");
    expect(await acceptInvite(other.client, token, "다른사람")).toEqual({ ok: false, reason: "invite_used" });
    expect(await getInviteStatus(admin, token)).toEqual({ status: "used" });
  });

  it("만료·위조 링크와 빈 이름은 거부되고 프로필이 생기지 않는다", async () => {
    const user = await createAuthOnlyUser("bad");
    const { token } = expectOk(await createServiceInvite(operator.client));
    expect(await acceptInvite(user.client, token, "   ")).toEqual({ ok: false, reason: "name_required" });

    await admin.from("service_invites").update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("token_hash", sha256Hex(token));
    expect(await acceptInvite(user.client, token, "만료")).toEqual({ ok: false, reason: "invite_expired" });
    expect(await acceptInvite(user.client, "forged-token", "위조")).toEqual({ ok: false, reason: "invite_invalid" });
    expect(await getInviteStatus(admin, "forged-token")).toEqual({ status: "invalid" });

    const { data } = await admin.from("profiles").select("user_id").eq("user_id", user.userId);
    expect(data).toEqual([]);
  });

  it("서비스 인원이 가득 차면 새 사람은 가입할 수 없다", async () => {
    const { token } = expectOk(await createServiceInvite(operator.client));
    const user = await createAuthOnlyUser("full");
    const { count } = await admin.from("profiles").select("*", { count: "exact", head: true });
    await setMaxUsers(count!);
    try {
      expect(await getInviteStatus(admin, token)).toEqual({ status: "service_full" });
      expect(await acceptInvite(user.client, token, "초과")).toEqual({ ok: false, reason: "service_full" });
    } finally {
      await setMaxUsers(TEST_MAX_USERS);
    }
  });
});

describe("그룹", () => {
  it("그룹에는 이름이 없다", async () => {
    const { data, error } = await admin.from("groups").select("*").limit(1);
    expect(error).toBeNull();
    for (const row of data ?? []) expect(row).not.toHaveProperty("name");
    const named = await admin.from("groups").select("name").limit(1);
    expect(named.error).not.toBeNull();
  });

  it("그룹 생성 권한이 있는 사람만, 한 번만 만든다", async () => {
    const owner = await serviceMember("maker");
    const groupId = expectOk(await createGroup(owner.client));
    const { data } = await admin.from("group_members").select("group_id, role").eq("user_id", owner.userId).single();
    expect(data).toEqual({ group_id: groupId, role: "owner" });
    expect(await createGroup(owner.client)).toEqual({ ok: false, reason: "already_in_group" });

    const noPerm = await createLoneUser("noperm");
    expect(await createGroup(noPerm.client)).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("그룹 초대는 그룹장만 발급하고, 수락하면 그룹원이 된다", async () => {
    const { owner, groupId } = await ownerWithGroup("ginv");
    const { token } = expectOk(await createGroupInvite(owner.client));
    expect(await getInviteStatus(admin, token)).toEqual({ status: "valid", kind: "group", inviterName: "ginv" });

    const spouse = await createAuthOnlyUser("spouse");
    expect(await acceptInvite(spouse.client, token, "배우자")).toEqual({ ok: true, value: { kind: "group", groupId } });
    expect(await createGroupInvite(spouse.client)).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("2명이 찬 그룹에는 더 들어갈 수 없다", async () => {
    const g = await createGroupFixture("full2");
    const fullToken = `full2-${g.groupId}`;
    const { data: inv } = await admin.from("group_invites").insert({
      group_id: g.groupId, token_hash: sha256Hex(fullToken), created_by: g.owner.userId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }).select("id").single();
    expect(inv).toBeTruthy();
    const third = await createAuthOnlyUser("third");
    expect(await acceptInvite(third.client, fullToken, "셋째")).toEqual({ ok: false, reason: "group_full" });
  });

  it("마지막 한 자리를 두 사람이 동시에 수락하면 한 명만 들어간다", async () => {
    const { owner, groupId } = await ownerWithGroup("race");
    const a = expectOk(await createGroupInvite(owner.client)).token;
    const b = expectOk(await createGroupInvite(owner.client)).token;
    const [u1, u2] = await Promise.all([createAuthOnlyUser("race1"), createAuthOnlyUser("race2")]);

    const results = await Promise.all([acceptInvite(u1.client, a, "하나"), acceptInvite(u2.client, b, "둘")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, reason: "group_full" });
    const { count } = await admin.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", groupId);
    expect(count).toBe(2);
  });

  it("이미 그룹이 있는 사람은 다른 그룹 초대를 수락할 수 없고 기존 소속이 유지된다", async () => {
    const { owner } = await ownerWithGroup("other");
    const { token } = expectOk(await createGroupInvite(owner.client));
    const g = await createGroupFixture("mine");
    expect(await acceptInvite(g.member.client, token, "이동")).toEqual({ ok: false, reason: "already_in_group" });
    const { data } = await admin.from("group_members").select("group_id").eq("user_id", g.member.userId).single();
    expect(data!.group_id).toBe(g.groupId);
  });

  it("취소한 그룹 초대는 수락할 수 없다", async () => {
    const { owner } = await ownerWithGroup("revoke");
    const { token } = expectOk(await createGroupInvite(owner.client));
    const { data: inv } = await admin.from("group_invites").select("id").eq("token_hash", sha256Hex(token)).single();
    expectOk(await revokeGroupInvite(owner.client, inv!.id));
    const user = await createAuthOnlyUser("late");
    expect(await acceptInvite(user.client, token, "늦음")).toEqual({ ok: false, reason: "invite_revoked" });
  });

  it("그룹장은 자기 그룹 초대 목록을 보지만 토큰 해시는 볼 수 없다", async () => {
    const { owner } = await ownerWithGroup("list");
    expectOk(await createGroupInvite(owner.client));
    const visible = await owner.client.from("group_invites").select("id, expires_at, used_at, revoked_at");
    expect(visible.data).toHaveLength(1);
    const hidden = await owner.client.from("group_invites").select("token_hash");
    expect(hidden.error).not.toBeNull();
  });
});

describe("초대 없이 로그인한 사용자", () => {
  it("프로필이 없으면 어떤 그룹 데이터도 읽거나 만들 수 없다", async () => {
    const stranger = await createAuthOnlyUser("stranger");
    const g = await createGroupFixture("strangertarget");
    await admin.from("transactions").insert({
      group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 1,
      merchant: "비밀", occurred_at: new Date().toISOString(),
    });
    const tx = await stranger.client.from("transactions").select("id");
    expect(tx.data).toEqual([]);
    expect(await createGroup(stranger.client)).toEqual({ ok: false, reason: "not_allowed" });
    expect(await issueIngestToken(stranger.client, "x")).toEqual({ ok: false, reason: "not_in_group" });
  });
});

describe("기기 토큰", () => {
  it("그룹원만 발급하고, 발급한 토큰으로 ingest 인증이 된다", async () => {
    const g = await createGroupFixture("dev");
    const { token, id } = expectOk(await issueIngestToken(g.member.client, "내 아이폰"));
    expect(id).toBeTruthy();
    expect(await resolveIngestToken(admin, token, new Date())).toEqual({ userId: g.member.userId, groupId: g.groupId });

    const lone = await createLoneUser("devlone");
    expect(await issueIngestToken(lone.client, "x")).toEqual({ ok: false, reason: "not_in_group" });
  });

  it("폐기하면 ingest가 거부되고, 사용자가 직접 되살릴 수 없다", async () => {
    const g = await createGroupFixture("rev");
    const { token, id } = expectOk(await issueIngestToken(g.owner.client, "갤럭시"));
    expectOk(await revokeIngestToken(g.owner.client, id));
    expect(await resolveIngestToken(admin, token, new Date())).toBeNull();

    const undo = await g.owner.client.from("ingest_tokens").update({ revoked_at: null }).eq("id", id);
    expect(undo.error).not.toBeNull();
    expect(await resolveIngestToken(admin, token, new Date())).toBeNull();
  });

  it("다른 사람의 토큰은 폐기할 수 없다", async () => {
    const g = await createGroupFixture("revother");
    const { token, id } = expectOk(await issueIngestToken(g.owner.client, "남의것"));
    expectOk(await revokeIngestToken(g.member.client, id));
    expect(await resolveIngestToken(admin, token, new Date())).not.toBeNull();
  });
});
