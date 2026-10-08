import { AppMenu } from "@/components/app-menu";
import { BudgetSummary } from "@/components/ledger/budget-summary";
import { spentByCategory } from "@/ledger/budget";
import { AddButton } from "@/components/ledger/add-button";
import { HomeLedger } from "@/components/ledger/home-ledger";
import type { DayView, RawView } from "@/components/ledger/home-types";
import { MonthSummary } from "@/components/ledger/month-summary";
import { NoGroup } from "@/components/no-group";
import { issuerLabel, paidWithOf } from "@/ledger/issuer";
import { compareMonth, kstLocalValue, kstMonthOf, monthParam, parseMonthParam } from "@/ledger/month";
import { loadMonth, loadUnparsed } from "@/ledger/queries";
import { guessFromSms } from "@/ledger/sms-guess";
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
  if (stage !== "home") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6">
        <header className="flex items-center py-3"><AppMenu me={me} showPartner={showPartner} /></header>
        {stage === "connect"
          ? <ConnectPrompt />
          : <LimitSetup connectedName={setup.connectedName} />}
      </main>
    );
  }
  const now = new Date();
  const month = parseMonthParam(sp.month, now);
  const [data, unparsed] = await Promise.all([loadMonth(supabase, me.groupId, month), loadUnparsed(supabase)]);
  const sum = totals(data.txs, data.members);
  const byId = new Map(data.txs.map((t) => [t.id, t]));
  const days: DayView[] = groupByDay(data.txs).map((g) => ({
    key: g.key,
    label: g.label,
    total: g.items.reduce((s, t) => s + t.amount, 0),
    items: g.items.map((t) => ({
      id: t.id, userId: t.userId, kind: t.kind, amount: t.amount, merchant: t.merchant, occurredAt: t.occurredAt.toISOString(),
      categoryId: t.categoryId, categorySource: t.categorySource, cancelled: data.cancelledIds.has(t.id), paidWith: t.paidWith ?? null,
      card: issuerLabel(t.issuer ?? null, t.kind, paidWithOf(t, byId)),
    })),
  }));
  const raws: RawView[] = unparsed.map((r) => {
    const g = guessFromSms(r.body, new Date(r.received_at));
    return {
      id: r.id, body: r.body, userId: r.user_id, receivedAt: r.received_at,
      guess: { amount: g.amount, merchant: g.merchant, occurredAt: g.occurredAt ? kstLocalValue(g.occurredAt) : undefined },
    };
  });

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-24">
      <header className="flex items-center justify-between py-3">
        <AppMenu me={me} showPartner={showPartner} />
        <AddButton month={monthParam(month)} />
      </header>
      {!setup.meConnected && <NotConnectedBanner />}
      <div className="card">
        <MonthSummary month={month} now={now} total={sum.total} byMember={sum.byMember} />
        <BudgetSummary
          budgets={data.budgets}
          spentTotal={sum.total}
          spentByCategory={spentByCategory(data.txs)}
          categoryNames={data.categoryNames}
          warnRatio={data.warnRatio}
          hiddenIds={data.hiddenIds}
        />
      </div>
      <HomeLedger
        days={days}
        month={monthParam(month)}
        choices={{ categories: data.categoryChoices, categoryNames: Object.fromEntries(data.categoryNames), members: data.members }}
        meId={me.userId}
        raws={raws}
        nowIso={now.toISOString()}
        empty={data.txs.length === 0 && compareMonth(month, kstMonthOf(now)) === 0 ? <EmptyCheer /> : null}
      />
    </main>
  );
}
