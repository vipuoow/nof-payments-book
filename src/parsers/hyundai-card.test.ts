import { describe, expect, it } from "vitest";
import {
  APPROVAL, APPROVAL_INSTALLMENT, APPROVAL_OTHER_CARD, CANCEL, NOT_HYUNDAI, UNKNOWN_HYUNDAI,
} from "./__fixtures__/hyundai-card";
import { APPROVAL as KB_APPROVAL } from "./__fixtures__/kb-card";
import { hyundaiCardParser } from "./hyundai-card";

const received = new Date("2026-10-07T16:46:00+09:00");

describe("hyundaiCardParser.canParse", () => {
  it("현대카드 문자만 맡는다", () => {
    expect(hyundaiCardParser.canParse(APPROVAL)).toBe(true);
    expect(hyundaiCardParser.canParse(APPROVAL_OTHER_CARD)).toBe(true);
    expect(hyundaiCardParser.canParse(UNKNOWN_HYUNDAI)).toBe(true);
    expect(hyundaiCardParser.canParse(NOT_HYUNDAI)).toBe(false);
    expect(hyundaiCardParser.canParse(KB_APPROVAL)).toBe(false);
  });
});

describe("hyundaiCardParser.parse", () => {
  it("승인: 누적액이 아닌 결제 금액과 가맹점·일시를 뽑는다", () => {
    expect(hyundaiCardParser.parse(APPROVAL, received)).toEqual({
      kind: "approval",
      amount: 2600,
      merchant: "테스트편의점 여의도점",
      occurredAt: new Date("2026-10-07T07:45:00.000Z"),
      issuer: "hyundai",
    });
  });

  it("취소는 양수 금액의 cancel", () => {
    expect(hyundaiCardParser.parse(CANCEL, received))
      .toMatchObject({ kind: "cancel", amount: 2600, merchant: "테스트편의점 여의도점" });
  });

  it("카드 이름이 달라도 읽는다", () => {
    expect(hyundaiCardParser.parse(APPROVAL_OTHER_CARD, received))
      .toMatchObject({ kind: "approval", amount: 45000, merchant: "테스트식당" });
  });

  it("할부 표기도 승인으로 해석한다", () => {
    expect(hyundaiCardParser.parse(APPROVAL_INSTALLMENT, received))
      .toMatchObject({ kind: "approval", amount: 360000 });
  });

  it("형식을 모르는 현대카드 문자는 unknown", () => {
    expect(hyundaiCardParser.parse(UNKNOWN_HYUNDAI, received)).toEqual({ kind: "unknown" });
  });

  it("[Web발신] 없음·CRLF·줄 끝 공백이어도 같은 결과", () => {
    const altered = APPROVAL.replace("[Web발신]\n", "").replace(/\n/g, "  \r\n");
    expect(hyundaiCardParser.parse(altered, received)).toEqual(hyundaiCardParser.parse(APPROVAL, received));
  });

  it("1월에 받은 12월 31일 문자는 전년도 거래", () => {
    const dec = APPROVAL.replace("10/07 16:45", "12/31 23:50");
    expect(hyundaiCardParser.parse(dec, new Date("2027-01-01T00:05:00+09:00")))
      .toMatchObject({ occurredAt: new Date("2026-12-31T14:50:00.000Z") });
  });

  it("있을 수 없는 날짜·시각은 unknown", () => {
    expect(hyundaiCardParser.parse(APPROVAL.replace("10/07 16:45", "13/45 99:99"), received)).toEqual({ kind: "unknown" });
    expect(hyundaiCardParser.parse(APPROVAL.replace("10/07 16:45", "02/30 10:00"), received)).toEqual({ kind: "unknown" });
  });

  it("가맹점 줄 없이 누적이 오면 unknown", () => {
    const noMerchant = APPROVAL.replace("테스트편의점 여의도점\n", "");
    expect(hyundaiCardParser.parse(noMerchant, received)).toEqual({ kind: "unknown" });
  });
});
