import Link from "next/link";
import { AppMenu } from "@/components/app-menu";
import { BudgetSummary } from "@/components/ledger/budget-summary";
import { spentByCategory } from "@/ledger/budget";
import { DayList } from "@/components/ledger/day-list";
import { MonthSummary } from "@/components/ledger/month-summary";
import { TxSheet } from "@/components/ledger/tx-sheet";
import { NoGroup } from "@/components/no-group";
import { isUuid } from "@/ledger/forms";
import { compareMonth, kstMonthOf, monthParam, parseMonthParam } from "@/ledger/month";
import { loadMonth, loadTransaction } from "@/ledger/queries";
import { groupByDay, totals } from "@/ledger/summary";
import { ConnectPrompt } from "@/components/home/connect-prompt";
import { EmptyCheer } from "@/components/home/empty-cheer";
import { LimitSetup } from "@/components/home/limit-setup";
import { NotConnectedBanner } from "@/components/home/not-connected-banner";
import { loadSetup } from "@/ledger/setup";
import { homeStage } from "@/ledger/stage";
import { loadMe } from "@/lib/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { supabase, me } = await loadMe();
  const sp = await searchParams;
  if (!me.groupId) return <NoGroup me={me} error={typeof sp.error === "string" ? sp.error : undefined} />;
  const setup = await loadSetup(supabase);
  const stage = homeStage(setup);
  const showPartner = me.role === "owner" && setup.memberCount < 2;
  const header = (
    <header className="flex items-center justify-between py-3">
      <AppMenu me={me} showPartner={showPartner} />
      <Link href="/new" aria-label="직접 입력" className="px-2 text-2xl text-accent">+</Link>
    </header>
  );
  if (stage !== "home") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6">
        {header}
        {stage === "connect"
          ? <ConnectPrompt />
          : <LimitSetup connectedName={setup.connectedName} />}
      </main>
    );
  }
  const now = new Date();
  const month = parseMonthParam(sp.month, now);
  const data = await loadMonth(supabase, me.groupId, month);
  const sum = totals(data.txs, data.members);
  const base = `/?month=${monthParam(month)}`;
  const selected = isUuid(sp.tx) ? await loadTransaction(supabase, sp.tx) : null;

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-24">
      {header}
      {!setup.meConnected && <NotConnectedBanner />}
      <MonthSummary month={month} now={now} total={sum.total} byMember={sum.byMember} />
      <BudgetSummary
        budgets={data.budgets}
        spentTotal={sum.total}
        spentByCategory={spentByCategory(data.txs)}
        categoryNames={data.categoryNames}
        warnRatio={data.warnRatio}
        hiddenIds={data.hiddenIds}
      />
      {data.unparsedCount > 0 && (
        <Link href="/unparsed" className="mt-3 block rounded-xl bg-surface px-4 py-3 text-sm">
          확인할 문자 {data.unparsedCount}건 <span className="float-right text-muted">›</span>
        </Link>
      )}
      {data.txs.length === 0 && compareMonth(month, kstMonthOf(now)) === 0 ? <EmptyCheer /> : <DayList
        groups={groupByDay(data.txs)}
        base={base}
        categoryNames={data.categoryNames}
        memberNames={new Map(data.members.map((m) => [m.userId, m.name]))}
        cancelledIds={data.cancelledIds}
      />}
      {selected && (
        <TxSheet tx={selected.tx} rawBody={selected.rawBody} choices={data.categoryChoices} members={data.members} closeHref={base} />
      )}
    </main>
  );
}
