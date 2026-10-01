import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("창 안에서 limit까지 허용하고 넘으면 거부, 창이 지나면 다시 허용", () => {
    let t = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t });
    expect([allow("a"), allow("a"), allow("a")]).toEqual([true, true, false]);
    expect(allow("b")).toBe(true);
    t = 60_000;
    expect(allow("a")).toBe(true);
  });

  it("키 개수가 maxKeys에 차면 만료된 키를 지우고, 그래도 차 있으면 새 키를 거부한다", () => {
    let t = 0;
    const allow = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 2, now: () => t });
    expect([allow("a"), allow("b")]).toEqual([true, true]);
    expect(allow("c")).toBe(false);
    expect(allow("a")).toBe(true); // 기존 키는 계속 허용
    t = 60_000;
    expect(allow("c")).toBe(true); // a·b 창이 끝나 정리됨
  });
});
