import { describe, expect, it } from "vitest";
import { DEVICE_STEPS, IOS_SHORTCUT_PATH, connectionCode, deviceGuide, parseDevice, tokenHealth } from "./devices";

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

  it("안내 단계가 기종 앱을 가리킨다", () => {
    expect(DEVICE_STEPS.iphone.join(" ")).toContain("단축어");
    expect(DEVICE_STEPS.android.join(" ")).toContain("MacroDroid");
  });

  it("국민카드와 현대카드 문자를 모두 보내도록 안내한다", () => {
    for (const steps of [DEVICE_STEPS.iphone, DEVICE_STEPS.android]) {
      expect(steps.join(" ")).toContain("KB국민카드");
      expect(steps.join(" ")).toContain("현대");
    }
  });
});

describe("connectionCode", () => {
  it("받는 주소와 토큰을 공백 하나로 잇는다(단축어가 공백으로 나눠 쓴다)", () => {
    expect(connectionCode("https://ledger.example/", "tok123")).toBe("https://ledger.example/api/ingest tok123");
    expect(connectionCode("https://ledger.example", null)).toBeNull();
  });

  it("아이폰 안내는 연결 코드 → 단축어 받기 → 자동화 순서다", () => {
    const steps = DEVICE_STEPS.iphone.join(" ");
    expect(steps.indexOf("연결 코드")).toBeGreaterThanOrEqual(0);
    expect(steps.indexOf("단축어 받기")).toBeGreaterThan(steps.indexOf("연결 코드"));
    expect(steps.indexOf("자동화")).toBeGreaterThan(steps.indexOf("단축어 받기"));
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
