import { describe, expect, it } from "vitest";
import { inferYear, isValidKstDateTime, kstDate } from "./kst";

describe("kstDate", () => {
  it("KST 시각을 UTC Date로 만든다", () => {
    expect(kstDate(2026, 9, 23, 8, 26).toISOString()).toBe("2026-09-22T23:26:00.000Z");
  });
});

describe("inferYear", () => {
  it("같은 달이면 수신 연도", () => {
    expect(inferYear(9, new Date("2026-09-23T08:27:00+09:00"))).toBe(2026);
  });

  it("1월에 받은 12월 문자는 전년도", () => {
    expect(inferYear(12, new Date("2027-01-01T09:00:00+09:00"))).toBe(2026);
  });

  it("KST로는 새해지만 UTC로는 전년 12월 31일이어도 KST 기준", () => {
    // UTC 2026-12-31T15:12Z = KST 2027-01-01 00:12
    expect(inferYear(1, new Date("2027-01-01T00:12:00+09:00"))).toBe(2027);
  });
});

describe("isValidKstDateTime", () => {
  it("있는 날짜·시각만 참", () => {
    expect(isValidKstDateTime(2026, 9, 23, 8, 26)).toBe(true);
    expect(isValidKstDateTime(2028, 2, 29, 0, 0)).toBe(true);
    expect(isValidKstDateTime(2026, 2, 30, 10, 0)).toBe(false);
    expect(isValidKstDateTime(2026, 13, 1, 10, 0)).toBe(false);
    expect(isValidKstDateTime(2026, 9, 23, 24, 0)).toBe(false);
    expect(isValidKstDateTime(2026, 9, 23, 8, 60)).toBe(false);
  });
});
