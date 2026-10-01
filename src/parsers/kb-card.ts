import { inferYear, kstDate } from "./kst";
import { smsLines as lines } from "./lines";
import type { CardSmsParser, ParseResult } from "./types";

// 승인·취소 문자 줄 구성:
// KB국민카드{끝4자리}{승인|취소} / {이름}님 / {금액}원 {일시불|N개월} / MM/DD HH:mm / {가맹점} / 누적{금액}원
const HEADER = /^KB국민카드\d{4}(승인|취소)$/;
const AMOUNT = /^([\d,]+)원\s+(?:일시불|\d+개월)$/;
const DATETIME = /^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/;

export const kbCardParser: CardSmsParser = {
  id: "kb-card",

  canParse(body) {
    return lines(body)[0]?.startsWith("KB국민카드") ?? false;
  },

  parse(body, receivedAt): ParseResult {
    const ls = lines(body);

    if (ls[0] === "KB국민카드" && ls[1]?.startsWith("후불교통")) {
      return { kind: "ignore", reason: "transit_billing_notice" };
    }

    const header = HEADER.exec(ls[0] ?? "");
    const amount = AMOUNT.exec(ls[2] ?? "");
    const datetime = DATETIME.exec(ls[3] ?? "");
    const merchant = ls[4];
    if (!header || !amount || !datetime || !merchant || merchant.startsWith("누적")) {
      return { kind: "unknown" };
    }

    const [month, day, hour, minute] = datetime.slice(1).map(Number);
    return {
      kind: header[1] === "승인" ? "approval" : "cancel",
      amount: Number(amount[1].replaceAll(",", "")),
      merchant,
      occurredAt: kstDate(inferYear(month, receivedAt), month, day, hour, minute),
      issuer: "kb",
    };
  },
};
