import { describe, expect, it } from "vitest";
import { kbCardParser } from "./kb-card";
import { hyundaiCardParser } from "./hyundai-card";
import { FOREIGN_APPROVAL, FOREIGN_CANCEL, FOREIGN_WITH_WON } from "./__fixtures__/kb-card";
import { FOREIGN_APPROVAL as HD_FOREIGN } from "./__fixtures__/hyundai-card";

const received = new Date("2026-10-05T12:00:00+09:00");

describe("해외 문자", () => {
  it("국민 해외승인: 외화·시각·가게(나라 뗌), 원화는 아직 없음", () => {
    expect(kbCardParser.parse(FOREIGN_APPROVAL, received)).toEqual({
      kind: "approval", amount: null, foreign: { currency: "USD", foreignAmount: 8 },
      merchant: "typesafe a", occurredAt: new Date("2026-10-02T09:08:00+09:00"), issuer: "kb",
    });
  });
  it("국민 해외취소", () => {
    expect(kbCardParser.parse(FOREIGN_CANCEL, received)).toMatchObject({ kind: "cancel", amount: null, foreign: { currency: "USD", foreignAmount: 8 } });
  });
  it("원화가 찍힌 해외 문자는 원화 그대로(외화 없음)", () => {
    expect(kbCardParser.parse(FOREIGN_WITH_WON, received)).toMatchObject({ kind: "approval", amount: 10739, merchant: "typesafe a" });
  });
  it("현대 해외승인(가정한 배치)", () => {
    expect(hyundaiCardParser.parse(HD_FOREIGN, received)).toEqual({
      kind: "approval", amount: null, foreign: { currency: "EUR", foreignAmount: 12.5 },
      merchant: "테스트카페 파리점", occurredAt: new Date("2026-10-04T21:15:00+09:00"), issuer: "hyundai",
    });
  });
  it("시각이 없으면 unknown", () => {
    expect(kbCardParser.parse("KB국민카드1234 해외승인\n8.00(USD)\n미국 typesafe a", received)).toEqual({ kind: "unknown" });
  });
});
