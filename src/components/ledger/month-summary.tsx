import Link from "next/link";
import { compareMonth, kstMonthOf, monthLabel, monthParam, shiftMonth, type Month } from "@/ledger/month";
import { formatWon, type Member } from "@/ledger/summary";

export function MonthSummary({
  month, now, total, byMember,
}: { month: Month; now: Date; total: number; byMember: Array<Member & { amount: number }> }) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canNext = compareMonth(next, kstMonthOf(now)) <= 0;
  return (
    <section className="py-2 text-center">
      <div className="flex items-center justify-center gap-6">
        <Link href={`/?month=${monthParam(prev)}`} aria-label="이전 달" className="px-2 text-accent">◀</Link>
        <h1 className="text-base font-semibold">{monthLabel(month)}</h1>
        {canNext
          ? <Link href={`/?month=${monthParam(next)}`} aria-label="다음 달" className="px-2 text-accent">▶</Link>
          : <span aria-hidden className="px-2 text-line">▶</span>}
      </div>
      <p data-testid="family-total" className="tabular mt-3 text-3xl font-bold">가족 {formatWon(total)}원</p>
      <p className="tabular mt-1 text-sm text-muted">
        {byMember.map((m) => `${m.name} ${formatWon(m.amount)}`).join(" · ")}
      </p>
    </section>
  );
}
