export const OVERLAP_MINUTES = 5;
export type OverlapRow = { userId: string; kind: string; amount: number; merchant: string; occurredAt: Date };

/** 붙여 넣어 저장하려는 결제와 겹치는(이미 들어온 것 같은) 거래. 취소는 보지 않는다. */
export function findOverlap(rows: OverlapRow[], t: { userId: string; amount: number; occurredAt: Date }): OverlapRow | null {
  const span = OVERLAP_MINUTES * 60_000;
  return rows.find((r) =>
    r.kind !== "cancel" && r.userId === t.userId && r.amount === t.amount
    && Math.abs(r.occurredAt.getTime() - t.occurredAt.getTime()) <= span) ?? null;
}
