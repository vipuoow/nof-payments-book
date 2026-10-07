import Link from "next/link";
import { compareMonth, kstMonthOf, monthLabel, monthParam, shiftMonth, type Month } from "@/ledger/month";
import { formatWon, type Member } from "@/ledger/summary";

/**
 * 홈 카드 윗부분: 달 고르기(‹ 지난달 · 이 달 · 다음 달 ›, 이번 달이면 오른쪽은 비움)와 쓴 돈 한 줄.
 * 금액 줄은 줄바꿈 없이 한 줄로만 보여 준다.
 */
export function MonthSummary({
  month, now, total, byMember,
}: { month: Month; now: Date; total: number; byMember: Array<Member & { amount: number }> }) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canNext = compareMonth(next, kstMonthOf(now)) <= 0;
  return (
    <section>
      <div className="grid grid-cols-[4rem_1fr_4rem] items-center text-sm">
        <Link href={`/?month=${monthParam(prev)}`} aria-label="이전 달" className="text-muted">‹ {prev.month}월</Link>
        <h1 className="text-center text-base font-semibold">{monthLabel(month)}</h1>
        {canNext
          ? <Link href={`/?month=${monthParam(next)}`} aria-label="다음 달" className="text-right text-muted">{next.month}월 ›</Link>
          : <span aria-hidden />}
      </div>
      <p data-testid="family-total" className="tabular mt-4 truncate whitespace-nowrap text-2xl font-bold tracking-tight">
        {formatWon(total)}원 썼어요
      </p>
      <p className="tabular mt-1 truncate whitespace-nowrap text-sm text-muted">
        {byMember.map((m) => `${m.name} ${formatWon(m.amount)}원`).join(" · ")}
      </p>
    </section>
  );
}
