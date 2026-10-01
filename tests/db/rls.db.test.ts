import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createGroupFixture, type GroupFixture } from "../helpers/db";

let a: GroupFixture;
let b: GroupFixture;
let bCategoryId: string;

beforeAll(async () => {
  a = await createGroupFixture("a");
  b = await createGroupFixture("b");
  const admin = adminClient();

  const raw = await admin
    .from("raw_messages")
    .insert({
      group_id: b.groupId, user_id: b.owner.userId, body: "b 원문", body_hash: `h-${b.groupId}`,
      source: "manual_test", received_at: new Date().toISOString(), status: "unparsed",
    })
    .select("id").single();
  if (raw.error) throw raw.error;

  const tx = await admin.from("transactions").insert({
    group_id: b.groupId, user_id: b.owner.userId, kind: "manual", amount: 1000,
    merchant: "B가게", occurred_at: new Date().toISOString(),
  });
  if (tx.error) throw tx.error;

  const cat = await admin.from("categories").insert({ group_id: b.groupId, name: "B전용" }).select("id").single();
  if (cat.error) throw cat.error;
  bCategoryId = cat.data.id;
});

describe("그룹 격리 RLS", () => {
  it("같은 그룹 거래는 그룹원 모두 볼 수 있다", async () => {
    const { data, error } = await b.member.client.from("transactions").select("merchant");
    expect(error).toBeNull();
    expect(data).toEqual([{ merchant: "B가게" }]);
  });

  it("다른 그룹 거래·원문은 보이지 않는다", async () => {
    const tx = await a.owner.client.from("transactions").select("id").eq("group_id", b.groupId);
    const raw = await a.owner.client.from("raw_messages").select("id").eq("group_id", b.groupId);
    expect(tx.data).toEqual([]);
    expect(raw.data).toEqual([]);
  });

  it("다른 그룹에 거래를 넣을 수 없다", async () => {
    const { error } = await a.owner.client.from("transactions").insert({
      group_id: b.groupId, user_id: a.owner.userId, kind: "manual", amount: 1,
      merchant: "침입", occurred_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("자기 그룹에도 수동 입력(manual) 외 거래는 직접 넣을 수 없다", async () => {
    const { error } = await a.owner.client.from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "approval", amount: 1,
      merchant: "위조", occurred_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("거래의 사용자를 다른 그룹 사람으로 바꿀 수 없다", async () => {
    const admin = adminClient();
    const { data: own, error } = await admin.from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "manual", amount: 500,
      merchant: "A가게", occurred_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    const res = await a.owner.client.from("transactions").update({ user_id: b.owner.userId }).eq("id", own.id);
    expect(res.error).not.toBeNull();
    const { data: after } = await admin.from("transactions").select("user_id").eq("id", own.id).single();
    expect(after!.user_id).toBe(a.owner.userId);
  });

  it("기본 카테고리와 자기 그룹 카테고리만 보인다", async () => {
    const { data } = await a.owner.client.from("categories").select("id, group_id");
    expect(data!.some((c) => c.id === bCategoryId)).toBe(false);
    expect(data!.filter((c) => c.group_id === null)).toHaveLength(9);
  });

  it("다른 그룹 카테고리는 수정되지 않는다", async () => {
    const { data } = await a.owner.client
      .from("categories").update({ name: "탈취" }).eq("id", bCategoryId).select("id");
    expect(data).toEqual([]);
  });

  it("자기 운영자 권한을 켤 수 없다", async () => {
    const { error } = await a.owner.client
      .from("profiles").update({ is_operator: true }).eq("user_id", a.owner.userId);
    expect(error).not.toBeNull();
  });

  it("다른 사용자의 ingest 토큰은 보이지 않는다", async () => {
    const admin = adminClient();
    await admin.from("ingest_tokens").insert({ user_id: b.owner.userId, token_hash: `t-${b.groupId}` });
    const { data } = await a.owner.client.from("ingest_tokens").select("id");
    expect(data).toEqual([]);
  });

  it("수동 입력·규칙·예산에 다른 그룹 카테고리를 붙일 수 없다", async () => {
    const tx = await a.owner.client.from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "manual", amount: 1,
      merchant: "남의카테고리", occurred_at: new Date().toISOString(), category_id: bCategoryId,
    });
    expect(tx.error).not.toBeNull();
    const rule = await a.owner.client.from("merchant_rules").insert({
      group_id: a.groupId, merchant_pattern: "x", category_id: bCategoryId,
    });
    expect(rule.error).not.toBeNull();
    const budget = await a.owner.client.from("budgets").insert({
      group_id: a.groupId, category_id: bCategoryId, month: "2026-10-01", amount: 1000,
    });
    expect(budget.error).not.toBeNull();
  });

  it("수동 입력에 취소 연결 칸을 직접 넣어 승인 거래를 가로챌 수 없다", async () => {
    const { data: approval, error: seedError } = await adminClient().from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "approval", amount: 5000,
      merchant: "진짜승인", occurred_at: new Date().toISOString(),
    }).select("id").single();
    if (seedError) throw seedError;
    const { error } = await a.owner.client.from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "manual", amount: -5000,
      merchant: "연결위조", occurred_at: new Date().toISOString(),
      cancels_transaction_id: approval.id,
    });
    expect(error).not.toBeNull();
  });

  it("로그인하지 않으면 아무것도 볼 수 없다", async () => {
    const { data } = await anonClient().from("transactions").select("id");
    expect(data ?? []).toEqual([]);
  });
});
