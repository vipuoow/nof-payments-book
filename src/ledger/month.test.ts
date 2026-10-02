import { describe, expect, it } from "vitest";
import {
  compareMonth, dayLabel, kstDayKey, kstLocalValue, kstMonthOf, monthLabel, monthParam, monthRange,
  parseKstLocal, parseMonthParam, shiftMonth,
} from "./month";

const oct1Kst0030 = new Date("2026-09-30T15:30:00Z"); // KST 2026-10-01 00:30

describe("월 계산 (KST)", () => {
  it("UTC로 9월 30일이어도 KST 10월 1일이면 10월", () => {
    expect(kstMonthOf(oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(kstDayKey(oct1Kst0030)).toBe("2026-10-01");
  });

  it("month 쿼리: 형식이 맞으면 그 달, 틀리거나 미래면 이번 달", () => {
    expect(parseMonthParam("2026-09", oct1Kst0030)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam(undefined, oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam(["2026-09"], oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam("2026-13", oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam("2026-9", oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam("2026-11", oct1Kst0030)).toEqual({ year: 2026, month: 10 });
  });

  it("월 이동은 연도를 넘긴다", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(compareMonth({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
  });

  it("월 범위는 KST 1일 0시부터 다음 달 1일 0시 전까지", () => {
    expect(monthRange({ year: 2026, month: 10 })).toEqual({
      from: new Date("2026-09-30T15:00:00Z"),
      to: new Date("2026-10-31T15:00:00Z"),
    });
    expect(monthRange({ year: 2026, month: 12 }).to).toEqual(new Date("2026-12-31T15:00:00Z"));
  });

  it("표기", () => {
    expect(monthParam({ year: 2026, month: 9 })).toBe("2026-09");
    expect(monthLabel({ year: 2026, month: 9 })).toBe("2026년 9월");
    expect(dayLabel("2026-10-01")).toBe("10월 1일 (목)");
    expect(dayLabel("2026-10-02")).toBe("10월 2일 (금)");
  });

  it("datetime-local 값은 KST로 해석하고, 없는 날짜는 null", () => {
    expect(parseKstLocal("2026-10-02T08:26")).toEqual(new Date("2026-10-01T23:26:00Z"));
    expect(kstLocalValue(new Date("2026-10-01T23:26:00Z"))).toBe("2026-10-02T08:26");
    expect(parseKstLocal("2026-02-30T10:00")).toBeNull();
    expect(parseKstLocal("2026-10-02 08:26")).toBeNull();
    expect(parseKstLocal("")).toBeNull();
  });
});
