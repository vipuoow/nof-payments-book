import { describe, expect, it } from "vitest";
import { detectDevice, guideSteps } from "./guide";

const both = { kb: true, hyundai: true };

describe("detectDevice", () => {
  it("Android가 들어 있으면 갤럭시, 나머지는 아이폰", () => {
    expect(detectDevice("Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36")).toBe("android");
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("iphone");
    expect(detectDevice(null)).toBe("iphone");
  });
});

describe("guideSteps", () => {
  it("아이폰 7단계: 카드 고르기 → 코드 → 단축어 → 붙여넣기 → 자동화 → 포함 글자 → 확인", () => {
    expect(guideSteps("iphone", both).map((s) => s.id)).toEqual(["cards", "code", "shortcut", "paste", "automation", "keyword", "check"]);
  });

  it("갤럭시 6단계: 카드 고르기 → 설치 → 트리거 → HTTP 요청 → 배터리 → 확인", () => {
    expect(guideSteps("android", both).map((s) => s.id)).toEqual(["cards", "install", "trigger", "http", "battery", "check"]);
  });

  it("고른 카드의 글자만 복사하게 한다", () => {
    const kw = (cards: { kb: boolean; hyundai: boolean }) =>
      guideSteps("iphone", cards).find((s) => s.id === "keyword")!.copies!.map((c) => c.key);
    expect(kw(both)).toEqual(["kb", "hyundai"]);
    expect(kw({ kb: true, hyundai: false })).toEqual(["kb"]);
    expect(kw({ kb: false, hyundai: true })).toEqual(["hyundai"]);
    const trigger = guideSteps("android", { kb: false, hyundai: true }).find((s) => s.id === "trigger")!;
    expect(trigger.copies!.map((c) => c.key)).toEqual(["hyundai"]);
  });

  it("연결 코드를 만드는 단계: 아이폰은 코드, 갤럭시는 주소·헤더·보낼 내용", () => {
    const ios = guideSteps("iphone", both).find((s) => s.action === "issue")!;
    expect(ios.copies!.map((c) => c.key)).toEqual(["code"]);
    const android = guideSteps("android", both).find((s) => s.action === "issue")!;
    expect(android.copies!.map((c) => c.key)).toEqual(["url", "header", "body"]);
  });
});
