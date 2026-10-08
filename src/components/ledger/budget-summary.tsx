import { budgetStatus, TOTAL, type BudgetLevel } from "@/ledger/budget";
import { formatWon } from "@/ledger/summary";

const TEXT: Record<BudgetLevel, string> = { ok: "", warn: "text-warning", over: "text-danger" };
const pct = (ratio: number) => Math.round(ratio * 100);
const left = (remaining: number) =>
  remaining >= 0 ? `${formatWon(remaining)}원 남음` : `${formatWon(-remaining)}원 초과`;

/**
 * 홈 카테고리 예산 경고: 경고 기준을 넘은 카테고리만. 전체 한도는 위의 한도 카드(SpendCard)가 보여 준다.
 * 숨긴 카테고리는 예산 화면에서 고칠 수 없으므로 경고에서도 뺀다.
 */
export function BudgetSummary({
  budgets, spentByCategory, categoryNames, warnRatio, hiddenIds,
}: {
  budgets: Map<string, number>;
  spentByCategory: Map<string, number>;
  categoryNames: Map<string, string>;
  warnRatio: number;
  hiddenIds: Set<string>;
}) {
  const warned = [...budgets]
    .filter(([key]) => key !== TOTAL && !hiddenIds.has(key))
    .map(([key, budget]) => ({ id: key, name: categoryNames.get(key) ?? "", ...budgetStatus(spentByCategory.get(key) ?? 0, budget, warnRatio) }))
    .filter((c) => c.level !== "ok")
    .sort((a, b) => b.ratio - a.ratio);
  if (warned.length === 0) return null;
  return (
    <section className="mt-3 flex flex-col gap-2">
      {warned.map((c) => (
        <p key={c.id} data-testid="budget-category" className={`tabular truncate whitespace-nowrap rounded-xl bg-danger/10 px-3 py-2 text-sm ${TEXT[c.level]}`}>
          {c.name} {pct(c.ratio)}% 썼어요 · {left(c.remaining)}
        </p>
      ))}
    </section>
  );
}
