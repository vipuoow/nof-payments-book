import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it("로그인·초대 화면은 로그인 없이 연다", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/verify")).toBe(true);
    expect(isPublicPath("/invite/abc")).toBe(true);
    expect(isPublicPath("/invite/abc/verify")).toBe(true);
  });

  it("나머지는 로그인이 필요하다", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/devices")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/invite")).toBe(false);
  });

  it("Google 로그인 콜백·정리 경로는 로그인 없이 연다", () => {
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/auth/no-profile")).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("같은 사이트 경로만 허용하고 나머지는 /", () => {
    expect(safeNextPath("/invite/abc")).toBe("/invite/abc");
    expect(safeNextPath("/group?x=1")).toBe("/group?x=1");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("invite")).toBe("/");
  });
});
