import { budgetStatus, TOTAL, type BudgetLevel } from "@/ledger/budget";
import { formatWon } from "@/ledger/summary";

const BAR: Record<BudgetLevel, string> = { ok: "bg-accent", warn: "bg-warning", over: "bg-danger" };
const TEXT: Record<BudgetLevel, string> = { ok: "", warn: "text-warning", over: "text-danger" };
const pct = (ratio: number) => Math.round(ratio * 100);
const left = (remaining: number) =>
  remaining >= 0 ? `${formatWon(remaining)}원 남음` : `${formatWon(-remaining)}원 초과`;

/**
 * 홈 예산: 전체 예산 막대 + 경고 기준을 넘은 카테고리만. 예산이 없으면 그리지 않는다.
 * 숨긴 카테고리는 예산 화면에서 고칠 수 없으므로 경고에서도 뺀다.
 */
export function BudgetSummary({
  budgets, spentTotal, spentByCategory, categoryNames, warnRatio, hiddenIds,
}: {
  budgets: Map<string, number>;
  spentTotal: number;
  spentByCategory: Map<string, number>;
  categoryNames: Map<string, string>;
  warnRatio: number;
  hiddenIds: Set<string>;
}) {
  const total = budgets.get(TOTAL);
  const totalStatus = total === undefined ? null : budgetStatus(spentTotal, total, warnRatio);
  const warned = [...budgets]
    .filter(([key]) => key !== TOTAL && !hiddenIds.has(key))
    .map(([key, budget]) => ({ id: key, name: categoryNames.get(key) ?? "", ...budgetStatus(spentByCategory.get(key) ?? 0, budget, warnRatio) }))
    .filter((c) => c.level !== "ok")
    .sort((a, b) => b.ratio - a.ratio);
  if (!totalStatus && warned.length === 0) return null;

  return (
    <section className="mt-3">
      {totalStatus && total !== undefined && (
        <div data-testid="budget-total">
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div className={`h-full ${BAR[totalStatus.level]}`} style={{ width: `${Math.min(totalStatus.ratio, 1) * 100}%` }} />
          </div>
          <p className="tabular mt-1 flex justify-between text-sm">
            <span className={TEXT[totalStatus.level]}>{left(totalStatus.remaining)}</span>
            <span className="text-muted">예산 {formatWon(total)}원 중 {pct(totalStatus.ratio)}%</span>
          </p>
        </div>
      )}
      {warned.map((c) => (
        <p key={c.id} data-testid="budget-category" className={`tabular mt-1 text-sm ${TEXT[c.level]}`}>
          {c.name} {pct(c.ratio)}% · {left(c.remaining)}
        </p>
      ))}
    </section>
  );
}
