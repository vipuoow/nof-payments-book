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
});
