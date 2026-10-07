import { describe, expect, it } from "vitest";
import { IOS_SHORTCUT_PATH, connectionCode, deviceGuide, parseDevice, tokenHealth } from "./devices";

describe("parseDevice", () => {
  it("android만 갤럭시, 나머지는 아이폰", () => {
    expect(parseDevice("android")).toBe("android");
    expect(parseDevice("iphone")).toBe("iphone");
    expect(parseDevice(undefined)).toBe("iphone");
    expect(parseDevice(["android"])).toBe("iphone");
    expect(parseDevice("windows")).toBe("iphone");
  });
});

describe("deviceGuide", () => {
  it("기종별 source와 문자 내용 자리, 토큰 전에는 자리 표시", () => {
    expect(deviceGuide("iphone", "https://ledger.example/", null)).toEqual({
      url: "https://ledger.example/api/ingest",
      headerValue: "Bearer <토큰>",
      body: '{"body":"메시지 내용","source":"ios_shortcut"}',
      source: "ios_shortcut",
    });
    expect(deviceGuide("android", "https://ledger.example", "tok123")).toEqual({
      url: "https://ledger.example/api/ingest",
      headerValue: "Bearer tok123",
      body: '{"body":"[sms_message]","source":"android_macrodroid"}',
      source: "android_macrodroid",
    });
  });

});

describe("connectionCode", () => {
  it("받는 주소와 토큰을 공백 하나로 잇는다(단축어가 공백으로 나눠 쓴다)", () => {
    expect(connectionCode("https://ledger.example/", "tok123")).toBe("https://ledger.example/api/ingest tok123");
    expect(connectionCode("https://ledger.example", null)).toBeNull();
  });

  it("단축어 파일 경로", () => {
    expect(IOS_SHORTCUT_PATH).toMatch(/^\/shortcuts\/.+\.shortcut$/);
  });
});

describe("tokenHealth", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  it("받은 적 없음·3일 초과·정상", () => {
    expect(tokenHealth(null, now)).toBe("never");
    expect(tokenHealth("2026-10-01T23:59:59Z", now)).toBe("stale");
    expect(tokenHealth("2026-10-02T00:00:00Z", now)).toBe("ok");
  });
});
