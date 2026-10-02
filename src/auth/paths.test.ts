import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it("배포 확인 주소는 로그인 없이 연다", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/healthx")).toBe(false);
  });

  it("PWA 매니페스트·아이콘은 로그인 없이 연다", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/apple-icon")).toBe(true);
  });

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

describe("safeNextPath 제어 문자", () => {
  it("탭·줄바꿈 등 제어 문자가 있으면 홈으로", () => {
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
    expect(safeNextPath("/\u0000x")).toBe("/");
    expect(safeNextPath("/group")).toBe("/group");
  });
});
