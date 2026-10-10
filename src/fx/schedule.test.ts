import { describe, expect, it } from "vitest";
import { msUntilNextRun } from "./schedule";

describe("다음 환율 받기 시각", () => {
  it("09:10 KST 전이면 그날 09:10", () => {
    expect(msUntilNextRun(new Date("2026-10-10T08:00:00+09:00"))).toBe(70 * 60_000);
  });
  it("지났으면 다음 날 09:10", () => {
    expect(msUntilNextRun(new Date("2026-10-10T09:10:00+09:00"))).toBe(24 * 3600_000);
    expect(msUntilNextRun(new Date("2026-10-10T23:00:00+09:00"))).toBe(10 * 3600_000 + 10 * 60_000);
  });
});
