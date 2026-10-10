import { describe, expect, it } from "vitest";
import { readMoney } from "./money";

const fx = (currency: string, foreignAmount: number) => ({ kind: "foreign", currency, foreignAmount });

describe("readMoney", () => {
  it("원화", () => {
    expect(readMoney("12,300원 일시불")).toEqual({ kind: "krw", amount: 12300 });
  });
  it("누적 줄은 건너뛴다", () => {
    expect(readMoney("누적1,234,567원\n900원 일시불")).toEqual({ kind: "krw", amount: 900 });
  });
  it("코드 뒤·괄호, 코드 앞, 쉼표·소수, 정수", () => {
    expect(readMoney("8.00(USD) 10/02 09:08")).toEqual(fx("USD", 8));
    expect(readMoney("USD 8.00")).toEqual(fx("USD", 8));
    expect(readMoney("1,234.50 EUR")).toEqual(fx("EUR", 1234.5));
    expect(readMoney("1500(JPY)")).toEqual(fx("JPY", 1500));
  });
  it("기호와 한글", () => {
    expect(readMoney("$8.00")).toEqual(fx("USD", 8));
    expect(readMoney("€12.50")).toEqual(fx("EUR", 12.5));
    expect(readMoney("¥1500")).toEqual(fx("JPY", 1500));
    expect(readMoney("£9.99")).toEqual(fx("GBP", 9.99));
    expect(readMoney("20달러")).toEqual(fx("USD", 20));
    expect(readMoney("12.5유로")).toEqual(fx("EUR", 12.5));
    expect(readMoney("1,500엔")).toEqual(fx("JPY", 1500));
    expect(readMoney("30위안")).toEqual(fx("CNY", 30));
    expect(readMoney("9파운드")).toEqual(fx("GBP", 9));
  });
  it("코드가 있으면 기호보다 코드", () => {
    expect(readMoney("$12.00 CAD")).toEqual(fx("CAD", 12));
  });
  it("동은 승인·취소가 있을 때만", () => {
    expect(readMoney("해외승인\n150,000동")).toEqual(fx("VND", 150000));
    expect(readMoney("테스트아파트 101동 1203호")).toBeNull();
  });
  it("원화가 있으면 원화가 먼저, 외화는 참고", () => {
    expect(readMoney("해외승인\n10,739원\n8.00(USD)")).toEqual({
      kind: "krw", amount: 10739, foreign: { currency: "USD", foreignAmount: 8 },
    });
  });
  it("ISO 목록 밖 대문자 3글자는 통화가 아니다, 원화가 있으면 원화", () => {
    expect(readMoney("ABC 5,000")).toBeNull();
    expect(readMoney("ZERO 승인 2,600원")).toEqual({ kind: "krw", amount: 2600 });
    expect(readMoney("ALL 5,000원")).toMatchObject({ kind: "krw", amount: 5000 });
  });
  it("금액이 없거나 0이면 null", () => {
    expect(readMoney("인증번호 [123456]")).toBeNull();
    expect(readMoney("0.00(USD)")).toBeNull();
  });

  it("가게 이름 속 ISO 단어(TOP·CUP)는 기호·코드를 이기지 못한다", () => {
    expect(readMoney("KB국민카드1234 해외승인\n$8.00 10/02 09:08\n미국 TOP GOLF")).toEqual(fx("USD", 8));
    expect(readMoney("해외승인\nUSD 8.00 10/02 09:08\nCUP NOODLE")).toEqual(fx("USD", 8));
    expect(readMoney("해외승인\n10/02 09:08 15 CUP NOODLE\nUSD 8.00")).toEqual(fx("USD", 8));
  });
  it("시각·날짜의 숫자는 금액이 아니다", () => {
    expect(readMoney("해외승인 10/02 09:08 TOP GOLF")).toBeNull();
  });
});

