import { afterEach, describe, expect, it, vi } from "vitest";
import { msUntilNextRun, startFxSchedule } from "./schedule";

describe("다음 환율 받기 시각", () => {
  it("09:10 KST 전이면 그날 09:10", () => {
    expect(msUntilNextRun(new Date("2026-10-10T08:00:00+09:00"))).toBe(70 * 60_000);
  });
  it("지났으면 다음 날 09:10", () => {
    expect(msUntilNextRun(new Date("2026-10-10T09:10:00+09:00"))).toBe(24 * 3600_000);
    expect(msUntilNextRun(new Date("2026-10-10T23:00:00+09:00"))).toBe(10 * 3600_000 + 10 * 60_000);
  });
});

describe("환율 타이머", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("한 번만 걸리고, 받기가 실패해도 처리되지 않은 오류를 남기지 않는다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on("unhandledRejection", onUnhandled);
    const failing = async () => { throw new Error("down"); };
    expect(startFxSchedule(failing)).toBe(true);
    expect(startFxSchedule(failing)).toBe(false);
    await vi.advanceTimersByTimeAsync(25 * 3600_000);
    await new Promise((r) => setImmediate(r));
    process.off("unhandledRejection", onUnhandled);
    expect(unhandled).toEqual([]);
  });
});

