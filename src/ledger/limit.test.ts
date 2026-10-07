import { describe, expect, it } from "vitest";
import { limitRows } from "./limit";

const G = "g1";
// 2026-10-15 12:00 KST
const oct = new Date("2026-10-15T03:00:00Z");

describe("limitRows", () => {
  it("이번 달부터: 이번 달 1일 행 하나", () => {
    expect(limitRows("this", oct, { thisMonthRow: false, amount: null }, 3_000_000, G)).toEqual([
      { group_id: G, category_id: null, month: "2026-10-01", amount: 3_000_000 },
    ]);
  });

  it("다음 달부터: 이번 달 행이 이미 있으면 다음 달 행만", () => {
    expect(limitRows("next", oct, { thisMonthRow: true, amount: 2_500_000 }, 3_000_000, G)).toEqual([
      { group_id: G, category_id: null, month: "2026-11-01", amount: 3_000_000 },
    ]);
  });

  it("다음 달부터: 이번 달 행이 없으면 지금 한도를 이번 달 행으로 남겨 이번 달 값이 바뀌지 않게 한다", () => {
    expect(limitRows("next", oct, { thisMonthRow: false, amount: 2_500_000 }, 3_000_000, G)).toEqual([
      { group_id: G, category_id: null, month: "2026-10-01", amount: 2_500_000 },
      { group_id: G, category_id: null, month: "2026-11-01", amount: 3_000_000 },
    ]);
  });

  it("다음 달부터: 지금 한도가 없으면 다음 달 행만", () => {
    expect(limitRows("next", oct, { thisMonthRow: false, amount: null }, 3_000_000, G)).toHaveLength(1);
  });

  it("12월의 다음 달은 다음 해 1월", () => {
    const dec = new Date("2026-12-31T05:00:00Z");
    expect(limitRows("next", dec, { thisMonthRow: true, amount: 1 }, 2, G)[0].month).toBe("2027-01-01");
  });

  it("달은 KST로 정한다: 10월 31일 23:30 KST는 10월, 11월 1일 00:10 KST는 11월", () => {
    expect(limitRows("this", new Date("2026-10-31T14:30:00Z"), { thisMonthRow: false, amount: null }, 1, G)[0].month).toBe("2026-10-01");
    expect(limitRows("this", new Date("2026-10-31T15:10:00Z"), { thisMonthRow: false, amount: null }, 1, G)[0].month).toBe("2026-11-01");
  });
});
