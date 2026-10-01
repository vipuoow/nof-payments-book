import { describe, expect, it } from "vitest";
import {
  APPROVAL, APPROVAL_INSTALLMENT, APPROVAL_SMALL, CANCEL, NOT_KB, TRANSIT_NOTICE, UNKNOWN_KB,
} from "./__fixtures__/kb-card";
import { kbCardParser } from "./kb-card";

const received = new Date("2026-09-23T08:27:00+09:00");

describe("kbCardParser.canParse", () => {
  it("국민카드 문자만 맡는다", () => {
    expect(kbCardParser.canParse(APPROVAL)).toBe(true);
    expect(kbCardParser.canParse(TRANSIT_NOTICE)).toBe(true);
    expect(kbCardParser.canParse(NOT_KB)).toBe(false);
  });
});

describe("kbCardParser.parse", () => {
  it("승인: 누적액이 아닌 결제 금액과 가맹점·일시를 뽑는다", () => {
    expect(kbCardParser.parse(APPROVAL, received)).toEqual({
      kind: "approval",
      amount: 12300,
      merchant: "테스트커피 강남역점(메가",
      occurredAt: new Date("2026-09-22T23:26:00.000Z"),
      issuer: "kb",
    });
  });

  it("취소는 양수 금액의 cancel", () => {
    const r = kbCardParser.parse(CANCEL, received);
    expect(r).toMatchObject({ kind: "cancel", amount: 12300, merchant: "테스트커피 강남역점(메가" });
  });

  it("쉼표 없는 소액", () => {
    expect(kbCardParser.parse(APPROVAL_SMALL, new Date("2026-09-30T00:00:00+09:00")))
      .toMatchObject({ kind: "approval", amount: 900, merchant: "지에스(GS)25 테스트점" });
  });

  it("할부 표기도 승인으로 해석한다", () => {
    expect(kbCardParser.parse(APPROVAL_INSTALLMENT, new Date("2026-09-30T00:00:00+09:00")))
      .toMatchObject({ kind: "approval", amount: 360000 });
  });

  it("후불교통 결제 예정 안내는 ignore", () => {
    expect(kbCardParser.parse(TRANSIT_NOTICE, received))
      .toEqual({ kind: "ignore", reason: "transit_billing_notice" });
  });

  it("형식을 모르는 국민카드 문자는 unknown", () => {
    expect(kbCardParser.parse(UNKNOWN_KB, received)).toEqual({ kind: "unknown" });
  });

  it("[Web발신] 없음·CRLF·줄 끝 공백이어도 같은 결과", () => {
    const altered = APPROVAL.replace("[Web발신]\n", "").replace(/\n/g, "  \r\n");
    expect(kbCardParser.parse(altered, received)).toEqual(kbCardParser.parse(APPROVAL, received));
  });

  it("1월에 받은 12월 31일 문자는 전년도 거래", () => {
    const dec = APPROVAL.replace("09/23 08:26", "12/31 23:50");
    const r = kbCardParser.parse(dec, new Date("2027-01-01T00:05:00+09:00"));
    expect(r).toMatchObject({ occurredAt: new Date("2026-12-31T14:50:00.000Z") });
  });
});
