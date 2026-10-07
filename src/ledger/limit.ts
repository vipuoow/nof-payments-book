import { budgetMonth } from "./budget";
import { kstMonthOf, shiftMonth } from "./month";

export type LimitChoice = "this" | "next";
export type LimitRow = { group_id: string; category_id: null; month: string; amount: number };

/**
 * 전체 한도를 바꿀 때 저장할 행(설계 4.7). 한도는 "그 달 이전의 가장 최근 행"이 이어지는 구조라
 * 지난 달 행은 건드리지 않는다. 다음 달부터 바꿀 때 이번 달 행이 없으면, 이번 달 값이 바뀌지 않도록
 * 지금 한도를 이번 달 행으로 함께 남긴다.
 */
export function limitRows(
  choice: LimitChoice,
  now: Date,
  current: { thisMonthRow: boolean; amount: number | null },
  newAmount: number,
  groupId: string,
): LimitRow[] {
  const thisMonth = kstMonthOf(now);
  const row = (month: string, amount: number): LimitRow => ({ group_id: groupId, category_id: null, month, amount });
  if (choice === "this") return [row(budgetMonth(thisMonth), newAmount)];
  const next = row(budgetMonth(shiftMonth(thisMonth, 1)), newAmount);
  if (!current.thisMonthRow && current.amount !== null) return [row(budgetMonth(thisMonth), current.amount), next];
  return [next];
}
