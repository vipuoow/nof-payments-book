import Link from "next/link";
import { redirect } from "next/navigation";
import { BudgetForm } from "@/components/ledger/budget-form";
import { spentByCategory, TOTAL } from "@/ledger/budget";
import { kstMonthOf, monthLabel } from "@/ledger/month";
import { loadMonth } from "@/ledger/queries";
import { totals } from "@/ledger/summary";
import { loadMe } from "@/lib/session";

export default async function BudgetPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const month = kstMonthOf(new Date());
  const data = await loadMonth(supabase, me.groupId, month);
  const spent = spentByCategory(data.txs);
  const entries = [
    { key: TOTAL, label: "가족 전체", amount: data.budgets.get(TOTAL) ?? null, spent: totals(data.txs, data.members).total },
    ...data.categoryChoices.map((c) => ({ key: c.id, label: c.name, amount: data.budgets.get(c.id) ?? null, spent: spent.get(c.id) ?? 0 })),
  ];

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">‹ 홈</Link>
        <h1 className="font-semibold">예산</h1>
        <span className="w-8" />
      </header>
      <p className="mb-4 text-sm text-muted">
        {monthLabel(month)} · 저장하면 이번 달부터 적용되고 다음 달에도 이어집니다. 비우면 예산이 없습니다.
      </p>
      <BudgetForm entries={entries} />
    </main>
  );
}
