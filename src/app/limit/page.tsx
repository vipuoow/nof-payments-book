import Link from "next/link";
import { ChevronLeft } from "@/components/icons";
import { redirect } from "next/navigation";
import { LimitForm } from "@/components/home/limit-form";
import { TOTAL } from "@/ledger/budget";
import { kstMonthOf, shiftMonth } from "@/ledger/month";
import { loadMonth } from "@/ledger/queries";
import { formatWon } from "@/ledger/summary";
import { loadMe } from "@/lib/session";

/** 한도 바꾸기: 이번 달부터 또는 다음 달부터. 지난 달 한도는 바뀌지 않는다. */
export default async function LimitPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const month = kstMonthOf(new Date());
  const data = await loadMonth(supabase, me.groupId, month);
  const current = data.budgets.get(TOTAL) ?? null;
  const next = shiftMonth(month, 1);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6">
      <header className="flex items-center py-3">
        <Link href="/" aria-label="홈" className="nav-icon"><ChevronLeft /></Link>
      </header>
      <section className="px-2 pb-4 pt-2">
        <h1 className="text-2xl font-bold">한도 바꾸기</h1>
        <p className="mt-1 text-muted">{current ? `지금 한도 ${formatWon(current)}원` : "아직 한도가 없어요"}</p>
      </section>
      <LimitForm thisLabel={`${month.month}월`} nextLabel={`${next.month}월`} current={current} />
      <Link href="/budget" className="mt-4 text-center text-sm text-muted">분류별 예산 ›</Link>
    </main>
  );
}
