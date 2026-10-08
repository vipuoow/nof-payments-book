import Link from "next/link";
import { ChevronLeft } from "@/components/icons";
import { redirect } from "next/navigation";
import { BudgetForm } from "@/components/ledger/budget-form";
import { spentByCategory } from "@/ledger/budget";
import { kstMonthOf, monthLabel } from "@/ledger/month";
import { loadMonth } from "@/ledger/queries";
import { loadMe } from "@/lib/session";

export default async function BudgetPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const month = kstMonthOf(new Date());
  const data = await loadMonth(supabase, me.groupId, month);
  const spent = spentByCategory(data.txs);
  // 전체 한도는 한도 화면(/limit)에서 바꾼다. 여기는 분류별 예산만.
  const entries = data.categoryChoices.map((c) => ({ key: c.id, label: c.name, amount: data.budgets.get(c.id) ?? null, spent: spent.get(c.id) ?? 0 }));

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/limit" aria-label="한도" className="nav-icon"><ChevronLeft /></Link>
        <h1 className="font-semibold">분류별 예산</h1>
        <span className="w-8" />
      </header>
      <p className="mb-4 text-sm text-muted">
        {monthLabel(month)} · 저장하면 이번 달부터 적용되고 다음 달에도 이어집니다. 비우면 예산이 없습니다.
      </p>
      <BudgetForm entries={entries} />
    </main>
  );
}
