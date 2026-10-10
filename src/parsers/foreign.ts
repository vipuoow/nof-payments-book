import { inferYear, isValidKstDateTime, kstDate } from "./kst";
import { readMoney } from "./money";
import type { Payment } from "./types";

const DATETIME = /(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/;
/** 가게 앞 나라 이름: 한글 한 단어 + 한글 없는 나머지(예: "미국 typesafe a") */
const COUNTRY = /^[가-힣]+\s+([^가-힣]+)$/;

/** 해외 형식(머리 줄에 해외승인/해외취소, 또는 외화 금액)인지 */
export function looksForeign(lines: string[]): boolean {
  if (/해외(승인|취소)/.test(lines[0] ?? "")) return true;
  return readMoney(lines.join("\n"))?.kind === "foreign";
}

/**
 * 해외 결제 문자: 종류는 머리 줄의 승인/취소, 금액은 readMoney, 시각은 MM/DD HH:mm,
 * 가게는 시각 뒤 같은 줄 또는 다음 줄. 가게 앞의 나라 이름(한글 한 단어, 나머지가 한글 없는 이름일 때)은 뗀다.
 */
export function readForeignCard(lines: string[], receivedAt: Date): Omit<Payment, "issuer"> | null {
  const head = /(승인|취소)/.exec(lines[0] ?? "");
  const money = readMoney(lines.join("\n"));
  const i = lines.findIndex((l) => DATETIME.test(l));
  if (!head || !money || i < 0) return null;
  const m = DATETIME.exec(lines[i])!;
  const [month, day, hour, minute] = m.slice(1, 5).map(Number);
  const year = inferYear(month, receivedAt);
  if (!isValidKstDateTime(year, month, day, hour, minute)) return null;
  const after = lines[i].slice(m.index + m[0].length).trim();
  const next = lines[i + 1];
  const raw = after && !readMoney(after) ? after : next && !next.includes("누적") && !readMoney(next) ? next : "";
  if (!raw) return null;
  const merchant = (COUNTRY.exec(raw)?.[1] ?? raw).slice(0, 100);
  const kind = head[1] === "승인" ? "approval" : "cancel";
  const occurredAt = kstDate(year, month, day, hour, minute);
  return money.kind === "krw"
    ? { kind, amount: money.amount, merchant, occurredAt }
    : { kind, amount: null, foreign: { currency: money.currency, foreignAmount: money.foreignAmount }, merchant, occurredAt };
}
