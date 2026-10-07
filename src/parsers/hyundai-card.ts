import { inferYear, isValidKstDateTime, kstDate } from "./kst";
import { smsLines as lines } from "./lines";
import type { CardSmsParser, ParseResult } from "./types";

// 승인·취소 문자 줄 구성:
// 현대 {카드이름} {승인|취소} (또는 현대카드 {카드이름} …) / {이름} / {금액}원 {일시불|N개월} / MM/DD HH:mm / {가맹점} / 누적{금액}원
// 현대해상·현대자동차 같은 다른 '현대' 문자는 맡지 않도록 '현대 ' 또는 '현대카드'로 시작하는 것만 본다.
const ISSUER = /^현대(?:카드|\s)/;
const HEADER = /^현대(?:카드)?\s.*\s(승인|취소)$/;
const AMOUNT = /^([\d,]+)원\s+(?:일시불|\d+개월)$/;
const DATETIME = /^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/;

export const hyundaiCardParser: CardSmsParser = {
  id: "hyundai-card",

  canParse(body) {
    return ISSUER.test(lines(body)[0] ?? "");
  },

  parse(body, receivedAt): ParseResult {
    const ls = lines(body);
    const header = HEADER.exec(ls[0] ?? "");
    const amount = AMOUNT.exec(ls[2] ?? "");
    const datetime = DATETIME.exec(ls[3] ?? "");
    const merchant = ls[4];
    if (!header || !amount || !datetime || !merchant || merchant.startsWith("누적")) {
      return { kind: "unknown" };
    }

    const [month, day, hour, minute] = datetime.slice(1).map(Number);
    const year = inferYear(month, receivedAt);
    if (!isValidKstDateTime(year, month, day, hour, minute)) return { kind: "unknown" };
    return {
      kind: header[1] === "승인" ? "approval" : "cancel",
      amount: Number(amount[1].replaceAll(",", "")),
      merchant,
      occurredAt: kstDate(year, month, day, hour, minute),
      issuer: "hyundai",
    };
  },
};
