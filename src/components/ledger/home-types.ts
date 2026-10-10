import type { CategorySource, Member, TxKind } from "@/ledger/summary";

/** 홈 목록 한 줄(서버에서 만들어 클라이언트로 넘긴다). occurredAt은 ISO 문자열 */
export type RowTx = {
  id: string;
  userId: string;
  kind: TxKind;
  amount: number;
  merchant: string;
  occurredAt: string;
  categoryId: string | null;
  categorySource: CategorySource;
  /** 금액 아래 결제 수단(국민카드·현대카드·온누리상품권·직접 입력) */
  card: string;
  /** 취소가 연결된 결제 */
  cancelled: boolean;
  paidWith: string | null;
};

export type DayView = { key: string; label: string; total: number; items: RowTx[] };

/** 확인할 문자 하나와 문자에서 찾은 값(occurredAt은 KST "YYYY-MM-DDTHH:mm") */
export type RawView = {
  id: string;
  body: string;
  userId: string;
  receivedAt: string;
  /** fxNote: 외화를 결제일 환율로 원화로 바꿨으면 계산 근거 */
  guess: { amount?: number; merchant?: string; occurredAt?: string; fxNote?: string };
};

export type LedgerChoices = {
  categories: { id: string; name: string }[];
  categoryNames: Record<string, string>;
  members: Member[];
};
