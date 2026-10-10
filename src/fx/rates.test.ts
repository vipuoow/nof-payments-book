import { describe, expect, it } from "vitest";
import { fxLabel, fxNote, fxStale, kstDateKey, krwPerUnit, parseErApi, toKrw } from "./rates";

const SAMPLE = { result: "success", base_code: "KRW", time_last_update_unix: 1759968001, rates: { KRW: 1, USD: 0.000745, JPY: 0.1102 } };

describe("환율", () => {
  it("응답 견본을 읽는다(날짜는 KST)", () => {
    expect(parseErApi(SAMPLE)).toEqual({ date: kstDateKey(new Date(1759968001 * 1000)), rates: SAMPLE.rates });
  });
  it("실패·형식 다름은 null", () => {
    expect(parseErApi({ result: "error" })).toBeNull();
    expect(parseErApi({ ...SAMPLE, base_code: "USD" })).toBeNull();
    expect(parseErApi({ ...SAMPLE, rates: { USD: "x" } })).toBeNull();
    expect(parseErApi(null)).toBeNull();
  });
  it("1단위 원화와 반올림", () => {
    expect(krwPerUnit(SAMPLE.rates, "USD")).toBe(1342.2819);
    expect(krwPerUnit(SAMPLE.rates, "EUR")).toBeNull();
    expect(toKrw(8, 1342.34)).toBe(10739);
  });
  it("KST 날짜", () => {
    expect(kstDateKey(new Date("2026-10-09T15:30:00Z"))).toBe("2026-10-10");
  });

  it("외화 표기: 정수면 정수, 아니면 소수 둘째 자리", () => {
    expect(fxLabel({ currency: "USD", foreignAmount: 8.5 })).toBe("8.50 USD");
    expect(fxLabel({ currency: "VND", foreignAmount: 150000 })).toBe("150,000 VND");
    expect(fxLabel({ currency: "USD", foreignAmount: 8 })).toBe("8 USD");
  });
  it("계산 안내 문구", () => {
    expect(fxNote({ currency: "USD", foreignAmount: 8 }, 1342.2819, "2026-10-02")).toBe("8 USD × 1,342.28원 (10월 2일 환율)로 계산했어요");
  });

  it("마지막 환율이 2일 이상 지났거나 없으면 갱신 실패", () => {
    const now = new Date("2026-10-10T12:00:00+09:00");
    expect(fxStale("2026-10-10", now)).toBe(false);
    expect(fxStale("2026-10-09", now)).toBe(false);
    expect(fxStale("2026-10-08", now)).toBe(true);
    expect(fxStale(null, now)).toBe(true);
  });
});
