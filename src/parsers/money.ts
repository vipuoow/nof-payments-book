import { ISO_CURRENCIES } from "./currencies";

export type Foreign = { currency: string; foreignAmount: number };
export type Money = { kind: "krw"; amount: number; foreign?: Foreign } | ({ kind: "foreign" } & Foreign);

const NUM = String.raw`([0-9][0-9,]*(?:\.[0-9]+)?)`;
const WON = /([0-9][0-9,]*)\s*원/;
const CODE_AFTER = new RegExp(String.raw`${NUM}\s*\(?\s*([A-Z]{3})(?![A-Za-z])`, "g");
const CODE_BEFORE = new RegExp(String.raw`(?<![A-Za-z])([A-Z]{3})\s*${NUM}`, "g");
const CODE_ANY = /(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g;
const SYMBOL = new RegExp(String.raw`([$€¥£])\s*${NUM}`);
const WORD = new RegExp(String.raw`${NUM}\s*(달러|유로|엔|파운드|위안|동)(?![가-힣])`);
const SYMBOL_CODE: Record<string, string> = { $: "USD", "€": "EUR", "¥": "JPY", "£": "GBP" };
const WORD_CODE: Record<string, string> = { 달러: "USD", 유로: "EUR", 엔: "JPY", 파운드: "GBP", 위안: "CNY", 동: "VND" };

const num = (s: string) => Number(s.replaceAll(",", ""));
const ok = (n: number) => Number.isFinite(n) && n > 0;
const isForeignCode = (c: string) => c !== "KRW" && ISO_CURRENCIES.has(c);

function readForeign(text: string): Foreign | null {
  for (const m of text.matchAll(CODE_AFTER)) {
    if (isForeignCode(m[2]) && ok(num(m[1]))) return { currency: m[2], foreignAmount: num(m[1]) };
  }
  for (const m of text.matchAll(CODE_BEFORE)) {
    if (isForeignCode(m[1]) && ok(num(m[2]))) return { currency: m[1], foreignAmount: num(m[2]) };
  }
  const code = [...text.matchAll(CODE_ANY)].map((m) => m[1]).find(isForeignCode);
  const sym = SYMBOL.exec(text);
  if (sym && ok(num(sym[2]))) return { currency: code ?? SYMBOL_CODE[sym[1]], foreignAmount: num(sym[2]) };
  const word = WORD.exec(text);
  if (word && ok(num(word[1]))) {
    if (word[2] === "동" && !/승인|취소/.test(text)) return null;
    return { currency: code ?? WORD_CODE[word[2]], foreignAmount: num(word[1]) };
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
