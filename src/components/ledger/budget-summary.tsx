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

  const line = "tabular truncate whitespace-nowrap";
  return (
    <section className="mt-4">
      {totalStatus && total !== undefined && (
        <div data-testid="budget-total">
          <div className="h-2.5 overflow-hidden rounded-full bg-background">
            <div className={`h-full rounded-full ${BAR[totalStatus.level]}`} style={{ width: `${Math.min(totalStatus.ratio, 1) * 100}%` }} />
          </div>
          <p className={`${line} mt-2 flex justify-between gap-2 text-sm`}>
            <span className={TEXT[totalStatus.level]}>
              {totalStatus.remaining >= 0 ? `${formatWon(totalStatus.remaining)}원 남았어요` : `${formatWon(-totalStatus.remaining)}원 넘었어요`}
            </span>
            <span className="text-muted">예산의 {pct(totalStatus.ratio)}%</span>
          </p>
        </div>
      )}
      {warned.map((c) => (
        <p key={c.id} data-testid="budget-category" className={`${line} mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm ${TEXT[c.level]}`}>
          {c.name} {pct(c.ratio)}% 썼어요 · {left(c.remaining)}
        </p>
      ))}
    </section>
  );
}
