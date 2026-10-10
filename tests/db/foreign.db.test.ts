import { describe, expect, it } from "vitest";
import { adminClient, createGroupFixture } from "../helpers/db";

const db = adminClient();
let n = 0;
async function ingest(g: { groupId: string; owner: { userId: string } }, a: Record<string, unknown>) {
  const { data, error } = await db.rpc("ingest_sms", {
    p_group: g.groupId, p_user: g.owner.userId, p_body: `foreign-${Date.now()}-${n++}`, p_body_hash: `h-${Date.now()}-${n++}`,
    p_source: "manual_test", p_received_at: new Date().toISOString(), p_status: "parsed", p_parser_id: "kb-card",
    p_merchant: "typesafe a", p_issuer: "kb", ...a,
  });
  if (error) throw error;
  return data as { status: string; transaction_id: string };
}
const tx = async (id: string) => (await db.from("transactions").select("*").eq("id", id).single()).data!;

describe("해외 결제 저장", () => {
  it("외화 칸과 예상 표시를 저장한다", async () => {
    const g = await createGroupFixture("fx1");
    const r = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    expect(await tx(r.transaction_id)).toMatchObject({ amount: 10739, currency: "USD", foreign_amount: 8, fx_rate: 1342.34, amount_estimated: true });
  });

  it("해외 취소는 짝지은 결제의 지금 원화(고친 값)를 쓴다", async () => {
    const g = await createGroupFixture("fx2");
    const a = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    await db.from("transactions").update({ amount: 11000 }).eq("id", a.transaction_id);
    const c = await ingest(g, { p_kind: "cancel", p_amount: 10800, p_occurred_at: "2026-10-03T01:00:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1350, p_amount_estimated: true });
    expect(await tx(c.transaction_id)).toMatchObject({ amount: -11000, cancels_transaction_id: a.transaction_id });
  });

  it("해외 취소가 먼저 오면, 결제가 올 때 취소 원화를 결제 원화로 맞춘다", async () => {
    const g = await createGroupFixture("fx3");
    const c = await ingest(g, { p_kind: "cancel", p_amount: 10800, p_occurred_at: "2026-10-03T01:00:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1350, p_amount_estimated: true });
    const a = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    expect(await tx(c.transaction_id)).toMatchObject({ amount: -10739, cancels_transaction_id: a.transaction_id });
  });
});

describe("카드 거래 금액 고치기", () => {
  it("해외 결제는 금액만 고칠 수 있고, 고치면 예상 표시가 꺼진다", async () => {
    const g = await createGroupFixture("fx4");
    const a = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    const { error } = await g.owner.client.from("transactions").update({ amount: 11000 }).eq("id", a.transaction_id);
    expect(error).toBeNull();
    expect(await tx(a.transaction_id)).toMatchObject({ amount: 11000, amount_estimated: false });
    const bad = await g.owner.client.from("transactions").update({ foreign_amount: 9 }).eq("id", a.transaction_id);
    // 외화 칸은 칸별 수정 권한이 없어 트리거 전에 막힌다(permission denied)
    expect(bad.error).not.toBeNull();
    expect((await tx(a.transaction_id)).foreign_amount).toBe(8);
  });

  it("국내 카드 거래 금액은 여전히 거절", async () => {
    const g = await createGroupFixture("fx5");
    const a = await ingest(g, { p_kind: "approval", p_amount: 5000, p_occurred_at: "2026-10-02T00:08:00Z" });
    const { error } = await g.owner.client.from("transactions").update({ amount: 6000 }).eq("id", a.transaction_id);
    expect(error?.message).toContain("card_tx_locked");
  });
});

describe("fx_rates 권한", () => {
  it("로그인한 사용자는 읽기만", async () => {
    const g = await createGroupFixture("fx6");
    await db.from("fx_rates").upsert({ date: "2026-10-01", base: "KRW", rates: { USD: 0.00075 } });
    const read = await g.owner.client.from("fx_rates").select("date").eq("date", "2026-10-01");
    expect(read.data).toHaveLength(1);
    const write = await g.owner.client.from("fx_rates").insert({ date: "2026-09-01", base: "KRW", rates: {} });
    expect(write.error).not.toBeNull();
  });
});
