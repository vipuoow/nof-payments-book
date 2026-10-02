import { describe, expect, it } from "vitest";
import { formatWon, groupByDay, totals, type LedgerTx } from "./summary";

const base: LedgerTx = {
  id: "t", userId: "u1", kind: "approval", amount: 0, merchant: "가게", occurredAt: new Date(),
  categoryId: null, categorySource: null, cancelsTransactionId: null, memo: "", rawMessageId: null,
};
const t = (over: Partial<LedgerTx>): LedgerTx => ({ ...base, ...over });

describe("totals", () => {
  it("취소(음수)를 반영한 가족 합계와 구성원별 합계", () => {
    const txs = [
      t({ id: "a", userId: "u1", amount: 12300 }),
      t({ id: "b", userId: "u1", kind: "cancel", amount: -12300 }),
      t({ id: "c", userId: "u2", amount: 900 }),
      t({ id: "d", userId: "gone", amount: 5000 }),
    ];
    expect(totals(txs, [{ userId: "u1", name: "지민" }, { userId: "u2", name: "서연" }])).toEqual({
      total: 5900,
      byMember: [{ userId: "u1", name: "지민", amount: 0 }, { userId: "u2", name: "서연", amount: 900 }],
    });
  });
});

describe("groupByDay", () => {
  it("KST 날짜별로 묶고 최신순", () => {
    const groups = groupByDay([
      t({ id: "old", occurredAt: new Date("2026-09-30T15:30:00Z") }),  // KST 10/1 00:30
      t({ id: "new", occurredAt: new Date("2026-10-02T03:00:00Z") }),  // KST 10/2 12:00
      t({ id: "mid", occurredAt: new Date("2026-10-01T14:00:00Z") }),  // KST 10/1 23:00
    ]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["10월 2일 (금)", ["new"]],
      ["10월 1일 (목)", ["mid", "old"]],
    ]);
  });
});

describe("formatWon", () => {
  it("천 단위 쉼표, 음수", () => {
    expect(formatWon(1234000)).toBe("1,234,000");
    expect(formatWon(-12300)).toBe("-12,300");
    expect(formatWon(0)).toBe("0");
  });
});
