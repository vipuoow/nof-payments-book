import { describe, expect, it } from "vitest";
import { barColorOf, themeOf } from "./theme";

describe("화면 모드", () => {
  it("쿠키 값이 없거나 이상하면 기본", () => {
    expect(themeOf(undefined)).toBe("basic");
    expect(themeOf("neon")).toBe("basic");
    expect(themeOf("dark")).toBe("dark");
    expect(themeOf("light")).toBe("light");
  });
  it("휴대폰 위쪽 띠 색은 배경 맨 위 색", () => {
    expect(barColorOf("basic")).toBe("#fcfbff");
    expect(barColorOf("light")).toBe("#f2f4f6");
    expect(barColorOf("dark")).toBe("#101013");
  });
});
