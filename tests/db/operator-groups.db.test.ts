import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGroup, createGroupInvite, createServiceInvite } from "@/auth/groups";
import { acceptInvite } from "@/auth/invites";
import { operatorDeleteAccount, operatorDeleteGroup, operatorOverview } from "@/auth/operator";
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
  operator = await createLoneUser("og-operator");
  await makeOperator(operator.userId);
});
afterAll(async () => { await setMaxUsers(30); });

/** 운영자 초대로 들어와 가계부를 만들고 파트너까지 들어온 그룹. 둘 다 휴대폰 연결(문자 도착)까지 */
async function fullGroup(label: string) {
  const owner = await createAuthOnlyUser(`${label}-o`);
  expectOk(await acceptInvite(owner.client, expectOk(await createServiceInvite(operator.client)).token, "구글"));
  const groupId = expectOk(await createGroup(owner.client, `${label}남편`.slice(0, 10)));
  const spouse = await createAuthOnlyUser(`${label}-s`);
  expectOk(await acceptInvite(spouse.client, expectOk(await createGroupInvite(owner.client, "아내")).token, "구글"));
  for (const u of [owner, spouse]) {
    await issueIngestToken(u.userId);
    await admin.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("user_id", u.userId);
  }
  await admin.from("transactions").insert({
    group_id: groupId, user_id: owner.userId, kind: "manual", amount: 1000, merchant: "가게", occurred_at: new Date().toISOString(),
  });
  await admin.from("budgets").insert({ group_id: groupId, category_id: null, month: "2026-10-01", amount: 100 });
  return { owner, spouse, groupId, ownerName: `${label}남편`.slice(0, 10) };
}

const count = async (table: string, col: string, value: string) =>
  (await admin.from(table).select("*", { count: "exact", head: true }).eq(col, value)).count;

describe("운영자 현황", () => {
  it("그룹마다 구성원·연결 상태·거래 수를 보여 준다", async () => {
    const g = await fullGroup("ogv");
    const o = await operatorOverview(operator.client);
    const mine = o.groups.find((x) => x.id === g.groupId)!;
    expect(mine.members.map((m) => [m.name, m.role, m.connected])).toEqual([[g.ownerName, "owner", true], ["아내", "member", true]]);
    expect(mine.txCount).toBe(1);
    expect(o.users).toBeGreaterThanOrEqual(2);
  });

  it("운영자가 아니면 볼 수 없다", async () => {
    const g = await fullGroup("ogx");
    await expect(operatorOverview(g.owner.client)).rejects.toThrow("not_allowed");
  });
});

describe("그룹 없애기", () => {
  it("그룹 정보는 모두 지우고, 계정·휴대폰 연결은 남기고, 가계부 만들기 권한은 거둔다", async () => {
    const g = await fullGroup("ogd");
    expectOk(await operatorDeleteGroup(operator.client, g.groupId, g.ownerName));

    expect(await count("groups", "id", g.groupId)).toBe(0);
    expect(await count("transactions", "group_id", g.groupId)).toBe(0);
    expect(await count("budgets", "group_id", g.groupId)).toBe(0);
    expect(await count("group_members", "group_id", g.groupId)).toBe(0);
    for (const u of [g.owner, g.spouse]) {
      const { data } = await admin.from("profiles").select("can_create_group, left_group_at").eq("user_id", u.userId).single();
      expect(data?.can_create_group).toBe(false);
      expect(data?.left_group_at).not.toBeNull();
      expect(await count("ingest_tokens", "user_id", u.userId)).toBe(1);
    }
    // 권한을 거뒀으니 스스로 가계부를 다시 만들 수 없다
    expect(await createGroup(g.owner.client, "다시")).toEqual({ ok: false, reason: "not_allowed" });
    // 가계부 없는 계정 목록에 나온다
    const o = await operatorOverview(operator.client);
    expect(o.groupless.map((x) => x.userId)).toEqual(expect.arrayContaining([g.owner.userId, g.spouse.userId]));
  });

  it("다시 초대받으면 휴대폰 연결 단계를 건너뛴다", async () => {
    const g = await fullGroup("ogr");
    expectOk(await operatorDeleteGroup(operator.client, g.groupId, g.ownerName));
    expectOk(await acceptInvite(g.owner.client, expectOk(await createServiceInvite(operator.client)).token, "구글"));
    expectOk(await createGroup(g.owner.client, "새남편"));
    const s = await loadSetup(g.owner.client);
    expect(s.anyConnected).toBe(true);
    expect(s.meConnected).toBe(true);
    const { data } = await admin.from("profiles").select("left_group_at").eq("user_id", g.owner.userId).single();
    expect(data?.left_group_at).toBeNull();
  });

  it("그룹장 닉네임이 틀리면 지우지 않는다", async () => {
    const g = await fullGroup("ogw");
    expect(await operatorDeleteGroup(operator.client, g.groupId, "엉뚱한이름")).toEqual({ ok: false, reason: "confirm_mismatch" });
    expect(await count("groups", "id", g.groupId)).toBe(1);
  });

  it("운영자가 든 그룹은 지울 수 없다", async () => {
    const opGroup = expectOk(await createGroup(operator.client, "운영자"));
    expect(await operatorDeleteGroup(operator.client, opGroup, "운영자")).toEqual({ ok: false, reason: "operator_group" });
    expect(await count("groups", "id", opGroup)).toBe(1);
  });

  it("운영자가 아니면 지울 수 없다", async () => {
    const g = await fullGroup("ogn");
    expect(await operatorDeleteGroup(g.spouse.client, g.groupId, g.ownerName)).toEqual({ ok: false, reason: "not_allowed" });
  });
});

describe("계정 지우기", () => {
  it("가계부 없는 계정만 지운다: 계정·휴대폰 연결이 사라지고 사용한 초대 기록은 남는다", async () => {
    const g = await fullGroup("oga");
    expect(await operatorDeleteAccount(operator.client, admin, g.owner.userId)).toEqual({ ok: false, reason: "in_group" });

    expectOk(await operatorDeleteGroup(operator.client, g.groupId, g.ownerName));
    const usedInvites = (await admin.from("service_invites").select("id").eq("used_by", g.owner.userId)).data!.map((r) => r.id);
    expect(usedInvites.length).toBeGreaterThan(0);

    expectOk(await operatorDeleteAccount(operator.client, admin, g.owner.userId));
    expect(await count("profiles", "user_id", g.owner.userId)).toBe(0);
    expect(await count("ingest_tokens", "user_id", g.owner.userId)).toBe(0);
    const { data: kept } = await admin.from("service_invites").select("used_by").in("id", usedInvites);
    expect(kept).toEqual(usedInvites.map(() => ({ used_by: null })));
    const { data: authUser } = await admin.auth.admin.getUserById(g.owner.userId);
    expect(authUser.user).toBeNull();
  });

  it("운영자 계정은 지울 수 없고, 운영자가 아니면 지울 수 없다", async () => {
    const other = await createLoneUser("og-op2");
    await makeOperator(other.userId);
    expect(await operatorDeleteAccount(operator.client, admin, other.userId)).toEqual({ ok: false, reason: "operator_account" });
    const lone = await createLoneUser("og-lone");
    expect(await operatorDeleteAccount(lone.client, admin, other.userId)).toEqual({ ok: false, reason: "not_allowed" });
  });
});
