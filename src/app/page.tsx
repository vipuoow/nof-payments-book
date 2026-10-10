import { AppMenu } from "@/components/app-menu";
import { BudgetSummary } from "@/components/ledger/budget-summary";
import { spentByCategory, TOTAL } from "@/ledger/budget";
import { AddButton } from "@/components/ledger/add-button";
import { HomeLedger } from "@/components/ledger/home-ledger";
import type { DayView, RawView } from "@/components/ledger/home-types";
import { MonthBody, MonthSwitch } from "@/components/ledger/month-switch";
import { SpendCard } from "@/components/ledger/spend-card";
import { NoGroup } from "@/components/no-group";
import { issuerLabel, paidWithOf } from "@/ledger/issuer";
import { compareMonth, kstLocalValue, kstMonthOf, monthLabel, monthParam, parseMonthParam, shiftMonth } from "@/ledger/month";
import { loadMonth, loadUnparsed } from "@/ledger/queries";
import { guessFromSms } from "@/ledger/sms-guess";
import { fxNote, toKrw } from "@/fx/rates";
import { NO_FETCH, rateFor } from "@/fx/store";
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
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
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
  const raws: RawView[] = await Promise.all(unparsed.map(async (r) => {
    const g = guessFromSms(r.body, new Date(r.received_at));
    let amount = g.amount;
    let fxNoteText: string | undefined;
    if (!amount && g.foreign) {
      const rate = await rateFor(supabase, g.foreign.currency, g.occurredAt ?? new Date(r.received_at), NO_FETCH);
      if (rate) {
        amount = toKrw(g.foreign.foreignAmount, rate.krwPer);
        fxNoteText = fxNote(g.foreign, rate.krwPer, rate.date);
      }
    }
    return {
      id: r.id, body: r.body, userId: r.user_id, receivedAt: r.received_at,
      guess: { amount, merchant: g.merchant, occurredAt: g.occurredAt ? kstLocalValue(g.occurredAt) : undefined, fxNote: fxNoteText },
    };
  }));

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-24">
      <header className="flex items-center justify-between py-3">
        <AppMenu me={me} showPartner={showPartner} />
        <AddButton month={monthParam(month)} />
      </header>
      {!setup.meConnected && <NotConnectedBanner />}
      <MonthSwitch>
      <SpendCard
        nav={{
          label: monthLabel(month),
          prev: { href: `/?month=${monthParam(prev)}`, month: prev.month, label: monthLabel(prev) },
          next: compareMonth(next, kstMonthOf(now)) <= 0
            ? { href: `/?month=${monthParam(next)}`, month: next.month, label: monthLabel(next) }
            : null,
        }}
        total={sum.total}
        byMember={sum.byMember}
        limit={data.budgets.get(TOTAL) ?? null}
      />
      {/* 달을 바꾸는 동안 아래는 자리표시로(카드와 함께) */}
      <MonthBody>
      <BudgetSummary
        budgets={data.budgets}
        spentByCategory={spentByCategory(data.txs)}
        categoryNames={data.categoryNames}
        warnRatio={data.warnRatio}
        hiddenIds={data.hiddenIds}
      />
      <HomeLedger
        days={days}
        month={monthParam(month)}
        choices={{ categories: data.categoryChoices, categoryNames: Object.fromEntries(data.categoryNames), members: data.members }}
        meId={me.userId}
        raws={raws}
        nowIso={now.toISOString()}
        empty={data.txs.length === 0 && compareMonth(month, kstMonthOf(now)) === 0 ? <EmptyCheer /> : null}
      />
      </MonthBody>
      </MonthSwitch>
    </main>
  );
}
