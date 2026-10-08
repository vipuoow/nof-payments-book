import { describe, expect, it } from "vitest";
import { APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { guessFromSms } from "./sms-guess";

const received = new Date("2026-10-08T05:00:00Z"); // KST 10/08 14:00

describe("guessFromSms", () => {
  it("국민카드 형식: 금액·시각·다음 줄의 가게를 찾고 누적 금액은 건너뛴다", () => {
    expect(guessFromSms(APPROVAL.replace("09/23", "10/07"), received)).toEqual({
      amount: 12300,
      merchant: "테스트커피 강남역점(메가",
      occurredAt: new Date("2026-10-06T23:26:00Z"),
    });
  });

  it("같은 줄 뒤에 가게가 있으면 그것을 쓴다", () => {
    const body = "[Web발신]\n신한카드(1234)승인 홍*동\n8,900원(일시불)\n10/08 14:22 테스트분식\n누적 245,000원";
    expect(guessFromSms(body, received)).toEqual({
      amount: 8900, merchant: "테스트분식", occurredAt: new Date("2026-10-08T05:22:00Z"),
    });
  });

  it("시각이 없으면 금액만", () => {
    expect(guessFromSms(UNKNOWN_KB, received)).toEqual({ amount: 1234567 });
  });

  it("금액도 시각도 없으면 빈 값, 없는 날짜는 무시", () => {
    expect(guessFromSms("(광고) 가을 세일\n무료수신거부 080", received)).toEqual({});
    expect(guessFromSms("누적 5,000원\n02/30 10:00 가게", received)).toEqual({});
  });

  it("받은 달보다 뒤의 달이면 지난해로 본다", () => {
    expect(guessFromSms("1,000원\n12/31 23:00\n가게", received).occurredAt).toEqual(new Date("2025-12-31T14:00:00Z"));
  });
});
