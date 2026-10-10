import { ISO_CURRENCIES } from "./currencies";

export type Foreign = { currency: string; foreignAmount: number };
export type Money = { kind: "krw"; amount: number; foreign?: Foreign } | ({ kind: "foreign" } & Foreign);

// 금액 숫자: 시각·날짜(09:08, 10/02)의 일부는 금액이 아니다
const NUM = String.raw`(?<![\d:/.,])([0-9][0-9,]*(?:\.[0-9]+)?)`;
const WON = /([0-9][0-9,]*)\s*원/;
// 코드와 숫자 사이는 같은 줄의 공백만(줄바꿈을 넘으면 다음 줄 가게 이름이 붙는다)
const CODE_AFTER = new RegExp(String.raw`${NUM}[ \t]*\(?[ \t]*([A-Z]{3})(?![A-Za-z])`, "g");
const CODE_BEFORE = new RegExp(String.raw`(?<![A-Za-z])([A-Z]{3})[ \t]*${NUM}`, "g");
const SYMBOL = new RegExp(String.raw`([$€¥£])[ \t]*${NUM}`);
const WORD = new RegExp(String.raw`${NUM}[ \t]*(달러|유로|엔|파운드|위안|동)(?![가-힣])`);
const SYMBOL_CODE: Record<string, string> = { $: "USD", "€": "EUR", "¥": "JPY", "£": "GBP" };
const WORD_CODE: Record<string, string> = { 달러: "USD", 유로: "EUR", 엔: "JPY", 파운드: "GBP", 위안: "CNY", 동: "VND" };
/**
 * 여행·직구에서 흔한 통화. 가게 이름 속 영어 단어 중 ISO 코드와 같은 것(TOP·CUP·ALL·PEN 등)보다 먼저 고른다.
 */
const COMMON = new Set(
  "USD EUR JPY CNY GBP CAD AUD NZD HKD SGD TWD THB VND PHP MYR IDR INR CHF SEK NOK DKK MXN AED TRY CZK HUF PLN MOP KHR MNT".split(" "),
);

const num = (s: string) => Number(s.replaceAll(",", ""));
const ok = (n: number) => Number.isFinite(n) && n > 0;
const isForeignCode = (c: string) => c !== "KRW" && ISO_CURRENCIES.has(c);

function readForeign(text: string): Foreign | null {
  // 숫자 바로 옆의 코드: 흔한 통화가 먼저, 같으면 문자에서 먼저 나온 것
  const found: { currency: string; foreignAmount: number; at: number }[] = [];
  for (const m of text.matchAll(CODE_AFTER)) {
    if (isForeignCode(m[2]) && ok(num(m[1]))) found.push({ currency: m[2], foreignAmount: num(m[1]), at: m.index });
  }
  for (const m of text.matchAll(CODE_BEFORE)) {
    if (isForeignCode(m[1]) && ok(num(m[2]))) found.push({ currency: m[1], foreignAmount: num(m[2]), at: m.index });
  }
  found.sort((a, b) => Number(COMMON.has(b.currency)) - Number(COMMON.has(a.currency)) || a.at - b.at);
  const sym = SYMBOL.exec(text);
  const symbolHit = sym && ok(num(sym[2])) ? { currency: SYMBOL_CODE[sym[1]], foreignAmount: num(sym[2]) } : null;
  // 기호 금액이 있으면, 옆에 붙은 흔한 통화 코드("$12.00 CAD")만 기호보다 앞선다
  if (found[0] && (COMMON.has(found[0].currency) || !symbolHit)) return { currency: found[0].currency, foreignAmount: found[0].foreignAmount };
  if (symbolHit) return symbolHit;
  const word = WORD.exec(text);
  if (word && ok(num(word[1]))) {
    if (word[2] === "동" && !/승인|취소/.test(text)) return null;
    return { currency: WORD_CODE[word[2]], foreignAmount: num(word[1]) };
  }
  return null;
}

/**
 * 문자에서 결제 금액을 찾는다. `원` 금액이 있으면 원화(외화 표시는 참고로 함께), 없으면 외화.
 * `누적`이 들어간 줄은 보지 않는다.
 */
export function readMoney(text: string): Money | null {
  const body = text.split(/\r?\n/).filter((l) => !l.includes("누적")).join("\n");
  const foreign = readForeign(body);
  const won = WON.exec(body);
  if (won && ok(num(won[1])) && Number.isSafeInteger(num(won[1]))) {
    return foreign ? { kind: "krw", amount: num(won[1]), foreign } : { kind: "krw", amount: num(won[1]) };
  }
  return foreign ? { kind: "foreign", ...foreign } : null;
}
