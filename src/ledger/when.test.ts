import { describe, expect, it } from "vitest";
import { dayShortcuts, joinLocal, splitLocal } from "./when";

describe("when", () => {
  it("오늘·어제·그저께의 KST 날짜", () => {
    // KST 10/01 00:30 — 어제는 지난달
    expect(dayShortcuts(new Date("2026-09-30T15:30:00Z"))).toEqual([
      { label: "오늘", date: "2026-10-01" },
      { label: "어제", date: "2026-09-30" },
      { label: "그저께", date: "2026-09-29" },
    ]);
  });
  it("날짜·시각 나누고 합치기", () => {
    expect(splitLocal("2026-10-08T14:05")).toEqual({ date: "2026-10-08", time: "14:05" });
    expect(joinLocal("2026-10-08", "14:05")).toBe("2026-10-08T14:05");
  });
});
