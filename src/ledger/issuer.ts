const ISSUERS: Record<string, string> = { kb: "국민카드", hyundai: "현대카드" };

/** 거래 줄 금액 아래에 보이는 결제 수단. 온누리상품권으로 표시했으면 그것, 직접 입력한 거래는 "직접 입력". */
export function issuerLabel(issuer: string | null, kind: string, paidWith: string | null = null): string {
  if (paidWith === "onnuri") return "온누리상품권";
  if (kind === "manual") return "직접 입력";
  return (issuer && ISSUERS[issuer]) || "카드";
}

type PaidWithTx = { kind: string; paidWith?: string | null; cancelsTransactionId: string | null };

/** 결제 수단 표시: 취소 줄은 원래 결제(같은 목록에 있으면)의 온누리 표시를 따른다 */
export function paidWithOf(tx: PaidWithTx, byId: Map<string, PaidWithTx>): string | null {
  if (tx.kind === "cancel" && tx.cancelsTransactionId) return byId.get(tx.cancelsTransactionId)?.paidWith ?? null;
  return tx.paidWith ?? null;
}
