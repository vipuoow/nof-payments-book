import { describe, expect, it } from "vitest";
import { APPROVAL as KB, CANCEL as KB_CANCEL } from "@/parsers/__fixtures__/kb-card";
import { APPROVAL as HD } from "@/parsers/__fixtures__/hyundai-card";
import { PASTE_ERROR, readPastedSms } from "./paste-sms";

const now = new Date("2026-10-08T12:00:00+09:00");

describe("readPastedSms (붙여 넣은 결제 문자)", () => {
  it("국민카드 승인 문자: 금액·가게·시각", () => {
    expect(readPastedSms(KB, now)).toEqual({
      ok: true, amount: 12300, merchant: "테스트커피 강남역점(메가", occurredAt: new Date("2026-09-23T08:26:00+09:00"),
    });
  });
  it("현대카드 승인 문자", () => {
    expect(readPastedSms(HD, now)).toMatchObject({ ok: true, amount: 2600, merchant: "테스트편의점 여의도점" });
  });
  it("분석기가 모르는 카드사 문자는 짐작으로 채운다", () => {
    const body = "[Web발신]\n신한카드(1234)승인\n홍*동\n4,500원 일시불\n10/08 09:10 테스트카페";
    expect(readPastedSms(body, now)).toEqual({
      ok: true, amount: 4500, merchant: "테스트카페", occurredAt: new Date("2026-10-08T09:10:00+09:00"),
    });
  });
  it("금액만 있고 시각이 없으면 금액만", () => {
    expect(readPastedSms("편의점 3,000원 결제", now)).toEqual({ ok: true, amount: 3000 });
  });
  it("취소 문자는 저장하지 않는다(분석기가 아는 카드사·모르는 카드사 모두)", () => {
    expect(readPastedSms(KB_CANCEL, now)).toEqual({ ok: false, reason: "cancel" });
    expect(readPastedSms("[Web발신]\n신한카드(1234)승인취소\n4,500원\n10/08 09:20 테스트카페", now))
      .toEqual({ ok: false, reason: "cancel" });
  });
  it("금액이 없거나 빈 글", () => {
    expect(readPastedSms("안녕하세요 광고입니다", now)).toEqual({ ok: false, reason: "no_amount" });
    expect(readPastedSms("   \n ", now)).toEqual({ ok: false, reason: "empty" });
  });
  it("안내 문구", () => {
    expect(PASTE_ERROR).toEqual({
      empty: "결제 문자를 붙여 넣어 주세요.",
      no_amount: "결제 금액을 찾지 못했어요. 문자를 확인하거나 직접 적어 주세요.",
      cancel: "취소 문자예요. 원래 결제를 찾아 지워 주세요.",
    });
  });
});
