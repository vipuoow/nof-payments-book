import { beforeEach, describe, expect, it } from "vitest";
import { fetchAndStoreRates, rateFor } from "@/fx/store";
import { adminClient } from "../helpers/db";

const db = adminClient();
const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
const SAMPLE = (unix: number, usd: number) => ({ result: "success", base_code: "KRW", time_last_update_unix: unix, rates: { KRW: 1, USD: usd } });

describe("환율 저장·조회", () => {
  beforeEach(async () => { await db.from("fx_rates").delete().gte("date", "1900-01-01"); });

  it("저장하고 그날 이전 값을 쓴다", async () => {
    expect(await fetchAndStoreRates(db, ok(SAMPLE(1759968001, 0.0008)))).toBe(true);
    const r = await rateFor(db, "USD", new Date("2026-12-01T00:00:00Z"), ok({}));
    expect(r?.krwPer).toBe(1250);
  });
  it("이전 값이 없으면 가장 가까운 이후 값", async () => {
    await fetchAndStoreRates(db, ok(SAMPLE(1759968001, 0.0008)));
    expect((await rateFor(db, "USD", new Date("2020-01-01T00:00:00Z"), ok({})))?.krwPer).toBe(1250);
  });
  it("표가 비면 한 번 받아 쓰고, 실패하면 null", async () => {
    expect(await rateFor(db, "USD", new Date(), ok({ result: "error" }))).toBeNull();
    expect((await rateFor(db, "USD", new Date(), ok(SAMPLE(1759968001, 0.0008))))?.krwPer).toBe(1250);
  });
  it("응답 오류·네트워크 실패는 저장하지 않는다", async () => {
    const boom = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await fetchAndStoreRates(db, boom)).toBe(false);
    expect((await db.from("fx_rates").select("date")).data).toHaveLength(0);
  });
});
