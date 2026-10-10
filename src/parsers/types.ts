import type { Foreign } from "./money";

export type Payment = {
  kind: "approval" | "cancel";
  /** 원화 결제·취소 금액(항상 양수). 누적 사용액이 아니다. 외화만 있으면 null(원화는 환율로 계산) */
  amount: number | null;
  /** 외화 금액. amount가 null이면 반드시 있다. 원화가 있으면 참고용 */
  foreign?: Foreign;
  /** 문자에 찍힌 가맹점 원문(잘려 있을 수 있음) */
  merchant: string;
  occurredAt: Date;
  issuer: string;
};

export type ParseResult = Payment | { kind: "ignore"; reason: string } | { kind: "unknown" };

export interface CardSmsParser {
  id: string;
  canParse(body: string): boolean;
  parse(body: string, receivedAt: Date): ParseResult;
}
