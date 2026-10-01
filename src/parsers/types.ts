export type ParseResult =
  | {
      kind: "approval" | "cancel";
      /** 결제·취소 금액(항상 양수). 누적 사용액이 아니다. */
      amount: number;
      /** 문자에 찍힌 가맹점 원문(잘려 있을 수 있음) */
      merchant: string;
      occurredAt: Date;
      issuer: string;
    }
  | { kind: "ignore"; reason: string }
  | { kind: "unknown" };

export interface CardSmsParser {
  id: string;
  canParse(body: string): boolean;
  parse(body: string, receivedAt: Date): ParseResult;
}
