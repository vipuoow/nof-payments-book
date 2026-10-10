import { describe, expect, it } from "vitest";
import { kstDateKey, krwPerUnit, parseErApi, toKrw } from "./rates";

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
});
