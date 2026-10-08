import { inferYear, isValidKstDateTime, kstDate } from "@/parsers/kst";
import { smsLines } from "@/parsers/lines";

export type SmsGuess = { amount?: number; merchant?: string; occurredAt?: Date };

const AMOUNT = /([0-9][0-9,]*)\s*원/;
const DATETIME = /(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(.*)$/;

/**
 * 가계부가 못 읽은 문자에서 금액·가게·시각을 짐작한다([거래로 등록]의 미리 채우기).
 * 누적 금액은 건너뛴다. 가게는 시각 뒤 같은 줄, 없으면 다음 줄(국민카드 형식).
 * 틀릴 수 있으니 사용자가 확인하고 고친다.
 */
export function guessFromSms(body: string, receivedAt: Date): SmsGuess {
  const lines = smsLines(body);
  const guess: SmsGuess = {};
  for (const line of lines) {
    if (line.includes("누적")) continue;
    const m = AMOUNT.exec(line);
    const amount = m ? Number(m[1].replaceAll(",", "")) : 0;
    if (amount >= 1 && Number.isSafeInteger(amount)) {
      guess.amount = amount;
      break;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const m = DATETIME.exec(lines[i]);
    if (!m) continue;
    const [month, day, hour, minute] = m.slice(1, 5).map(Number);
    const year = inferYear(month, receivedAt);
    if (!isValidKstDateTime(year, month, day, hour, minute)) break;
    guess.occurredAt = kstDate(year, month, day, hour, minute);
    const next = lines[i + 1];
    const merchant = m[5].trim() || (next && !next.includes("누적") && !AMOUNT.test(next) ? next : "");
    if (merchant) guess.merchant = merchant.slice(0, 100);
    break;
  }
  return guess;
}
