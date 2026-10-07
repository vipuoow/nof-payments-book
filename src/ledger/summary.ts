import { dayLabel, kstDayKey } from "./month";

export type TxKind = "approval" | "cancel" | "manual";
export type CategorySource = "rule" | "ai" | "user" | null;

export type LedgerTx = {
  id: string;
  userId: string;
  kind: TxKind;
  /** 취소는 음수 */
  amount: number;
  merchant: string;
  occurredAt: Date;
  categoryId: string | null;
  categorySource: CategorySource;
  cancelsTransactionId: string | null;
  memo: string;
  rawMessageId: string | null;
  /** 카드사(kb·hyundai). 직접 입력은 null */
  issuer?: string | null;
};

export type Member = { userId: string; name: string };
export type DayGroup = { key: string; label: string; items: LedgerTx[] };

/** 가족 합계(모든 거래)와 현재 구성원별 합계. 취소는 음수라 그대로 더한다. */
export function totals(txs: LedgerTx[], members: Member[]) {
  const byUser = new Map<string, number>();
  let total = 0;
  for (const tx of txs) {
    total += tx.amount;
    byUser.set(tx.userId, (byUser.get(tx.userId) ?? 0) + tx.amount);
  }
  return { total, byMember: members.map((m) => ({ ...m, amount: byUser.get(m.userId) ?? 0 })) };
}

/** KST 날짜별로 묶어 최신순 */
export function groupByDay(txs: LedgerTx[]): DayGroup[] {
  const sorted = [...txs].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const groups: DayGroup[] = [];
  for (const tx of sorted) {
    const key = kstDayKey(tx.occurredAt);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(key), items: [] };
      groups.push(group);
    }
    group.items.push(tx);
  }
  return groups;
}

const won = new Intl.NumberFormat("ko-KR");

export function formatWon(n: number): string {
  return won.format(n);
}
