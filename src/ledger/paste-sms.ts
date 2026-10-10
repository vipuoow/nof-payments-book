import { parseSms } from "@/parsers";
import type { Foreign } from "@/parsers/money";
import { guessFromSms } from "./sms-guess";

export type PasteRead =
  /** amount는 원화. 외화만 있으면 amount 없이 foreign(원화는 서버가 결제일 환율로 계산) */
  | { ok: true; amount?: number; foreign?: Foreign; merchant?: string; occurredAt?: Date }
  | { ok: false; reason: "empty" | "no_amount" | "cancel" };

export const PASTE_ERROR = {
  empty: "결제 문자를 붙여 넣어 주세요.",
  no_amount: "결제 금액을 찾지 못했어요. 문자를 확인하거나 직접 적어 주세요.",
  cancel: "취소 문자예요. 원래 결제를 찾아 지워 주세요.",
} as const;

/**
 * 새로 추가 › 결제문자 붙여넣기: 붙여 넣은 글에서 금액·가게·시각을 찾는다(브라우저에서, 원문은 보내지 않음).
 * 국민·현대 분석기가 먼저 읽고, 못 읽으면 문자 짐작으로 찾는다. 취소 문자는 결제로 만들지 않는다.
 */
export function readPastedSms(text: string, now: Date): PasteRead {
  const body = text.trim();
  if (!body) return { ok: false, reason: "empty" };
  const { result } = parseSms(body, now);
  if (result.kind === "cancel") return { ok: false, reason: "cancel" };
  if (result.kind === "approval") {
    return result.amount !== null
      ? { ok: true, amount: result.amount, merchant: result.merchant, occurredAt: result.occurredAt }
      : { ok: true, foreign: result.foreign, merchant: result.merchant, occurredAt: result.occurredAt };
  }
  // 분석기가 모르는 카드사도 취소 문자는 결제로 만들지 않는다
  if (body.includes("취소")) return { ok: false, reason: "cancel" };
  const g = guessFromSms(body, now);
  if (!g.amount && !g.foreign) return { ok: false, reason: "no_amount" };
  return {
    ok: true,
    ...(g.amount ? { amount: g.amount } : { foreign: g.foreign }),
    ...(g.merchant ? { merchant: g.merchant } : {}),
    ...(g.occurredAt ? { occurredAt: g.occurredAt } : {}),
  };
}
