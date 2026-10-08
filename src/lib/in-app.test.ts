import { describe, expect, it } from "vitest";
import { absoluteUrl, detectInApp, externalOpenUrl, outsideBrowser } from "./in-app";

const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const KAKAO = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 25.8.0";

describe("detectInApp", () => {
  it("일반 브라우저는 null", () => {
    expect(detectInApp(SAFARI)).toBeNull();
    expect(detectInApp(null)).toBeNull();
  });
  it("카카오톡·네이버·인스타그램·페이스북·라인·밴드 안 브라우저를 알아챈다", () => {
    expect(detectInApp(KAKAO)).toEqual({ app: "kakao", name: "카카오톡" });
    expect(detectInApp(`${SAFARI} NAVER(inapp; search; 1000; 12.0.0)`)?.app).toBe("naver");
    expect(detectInApp(`${SAFARI} Instagram 300.0.0.0`)?.app).toBe("instagram");
    expect(detectInApp(`${SAFARI} [FBAN/FBIOS;FBAV/450.0]`)?.app).toBe("facebook");
    expect(detectInApp(`${SAFARI} Line/14.0.0`)?.app).toBe("line");
    expect(detectInApp(`${SAFARI} BAND/12.0.0`)?.app).toBe("band");
  });
});

describe("externalOpenUrl", () => {
  const url = "https://ledger.example/invite/abc?x=1";
  it("카카오톡은 외부 브라우저로 여는 주소", () => {
    expect(externalOpenUrl("kakao", url)).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`);
  });
  it("라인은 openExternalBrowser=1을 붙인다", () => {
    expect(externalOpenUrl("line", url)).toBe("https://ledger.example/invite/abc?x=1&openExternalBrowser=1");
    expect(externalOpenUrl("line", "https://ledger.example/login")).toBe("https://ledger.example/login?openExternalBrowser=1");
  });
  it("그 밖의 앱은 바로 여는 방법이 없다(null)", () => {
    expect(externalOpenUrl("naver", url)).toBeNull();
    expect(externalOpenUrl("instagram", url)).toBeNull();
  });
});

describe("outsideBrowser", () => {
  it("아이폰은 Safari, 그 밖(갤럭시 등)은 기본 브라우저", () => {
    expect(outsideBrowser(KAKAO)).toBe("Safari");
    expect(outsideBrowser("Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK 10.8.0")).toBe("기본 브라우저");
  });
});

describe("absoluteUrl", () => {
  it("APP_URL이 있으면 그 주소로(끝 슬래시 정리)", () => {
    expect(absoluteUrl("https://ledger.example/", null, null, "/login")).toBe("https://ledger.example/login");
  });
  it("APP_URL이 비면 요청의 host·proto로 만든다", () => {
    expect(absoluteUrl("", "ledger.example", "https", "/devices")).toBe("https://ledger.example/devices");
    expect(absoluteUrl(undefined, "127.0.0.1:3100", null, "/login")).toBe("http://127.0.0.1:3100/login");
  });
  it("아무것도 없으면 null(버튼을 숨긴다)", () => {
    expect(absoluteUrl("", null, null, "/login")).toBeNull();
  });
});
