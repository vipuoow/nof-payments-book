import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryOptions, type CategoryRow } from "@/categorize/categorize";
import { budgetMonth, effectiveBudgets } from "./budget";
import { monthRange, type Month } from "./month";
import type { CategorySource, LedgerTx, Member, TxKind } from "./summary";

export type CategoryLite = { id: string; name: string };
export type MonthData = {
  txs: LedgerTx[];
  members: Member[];
  categoryNames: Map<string, string>;
  categoryChoices: CategoryLite[];
  cancelledIds: Set<string>;
  budgets: Map<string, number>;
  warnRatio: number;
  /** 그룹이 숨긴 기본 카테고리 */
  hiddenIds: Set<string>;
};

const TX_COLUMNS =
  "id, user_id, kind, amount, merchant, occurred_at, category_id, category_source, cancels_transaction_id, memo, raw_message_id, issuer, paid_with, currency, foreign_amount, fx_rate, amount_estimated";

type TxRow = {
  id: string; user_id: string; kind: TxKind; amount: number; merchant: string; occurred_at: string;
  category_id: string | null; category_source: CategorySource; cancels_transaction_id: string | null;
  memo: string; raw_message_id: string | null; issuer: string | null; paid_with: string | null;
  currency: string | null; foreign_amount: number | null; fx_rate: number | null; amount_estimated: boolean;
};

function toLedgerTx(r: TxRow): LedgerTx {
  return {
    id: r.id, userId: r.user_id, kind: r.kind, amount: Number(r.amount), merchant: r.merchant,
    occurredAt: new Date(r.occurred_at), categoryId: r.category_id, categorySource: r.category_source,
    cancelsTransactionId: r.cancels_transaction_id, memo: r.memo, rawMessageId: r.raw_message_id, issuer: r.issuer, paidWith: r.paid_with,
    fx: r.currency
      ? { currency: r.currency, foreignAmount: Number(r.foreign_amount), rate: r.fx_rate === null ? null : Number(r.fx_rate), estimated: r.amount_estimated }
      : null,
  };
}

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

/** 그룹 구성원(그룹장 먼저)과 표시 이름 */
export async function loadMembers(db: SupabaseClient, groupId: string): Promise<Member[]> {
  const rows = await must<{ user_id: string; role: string }[]>(
    db.from("group_members").select("user_id, role").eq("group_id", groupId),
  );
  const profiles = await must<{ user_id: string; display_name: string }[]>(
    db.from("profiles").select("user_id, display_name").in("user_id", rows.map((r) => r.user_id)),
  );
  const names = new Map(profiles.map((p) => [p.user_id, p.display_name]));
  return [...rows]
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
    .map((r) => ({ userId: r.user_id, name: names.get(r.user_id) ?? "알 수 없음" }));
}

/** 보이는 카테고리(기본 + 내 그룹, RLS). 버튼용은 숨긴 것을 빼고 이름이 겹치면 그룹 것만. */
export async function loadCategories(db: SupabaseClient) {
  const [rows, hidden] = await Promise.all([
    must<CategoryRow[]>(db.from("categories").select("id, name, group_id").order("sort_order").order("name")),
    must<{ category_id: string }[]>(db.from("category_hidden").select("category_id")),
  ]);
  const hiddenIds = new Set(hidden.map((h) => h.category_id));
  return {
    names: new Map(rows.map((r) => [r.id, r.name])),
    choices: categoryOptions(rows.filter((r) => !hiddenIds.has(r.id))).map(({ id, name }) => ({ id, name })),
    rows,
    hiddenIds,
  };
}

/** 그 달에 적용되는 예산(키: 카테고리 id 또는 TOTAL) */
export async function loadBudgets(db: SupabaseClient, month: Month): Promise<Map<string, number>> {
  const rows = await must<{ category_id: string | null; month: string; amount: number }[]>(
    db.from("budgets").select("category_id, month, amount").lte("month", budgetMonth(month)),
  );
  return effectiveBudgets(
    rows.map((r) => ({ categoryId: r.category_id, month: r.month, amount: Number(r.amount) })),
    month,
  );
}

export async function loadMonth(db: SupabaseClient, groupId: string, month: Month): Promise<MonthData> {
  const { from, to } = monthRange(month);
  const [rows, members, categories, budgets, warn] = await Promise.all([
    must<TxRow[]>(
      db.from("transactions").select(TX_COLUMNS)
        .gte("occurred_at", from.toISOString()).lt("occurred_at", to.toISOString())
        .order("occurred_at", { ascending: false }),
    ),
    loadMembers(db, groupId),
    loadCategories(db),
    loadBudgets(db, month),
    db.from("app_settings").select("value").eq("key", "budget_warning_ratio").single(),
  ]);
  if (warn.error) throw warn.error;

  const txs = rows.map(toLedgerTx);
  // 취소가 연결된 결제. 취소는 결제 후 60일 안에 오므로(find_cancel_target) 그 범위의 취소만 본다.
  // 결제 id 목록을 in()으로 보내면 거래가 많은 달에 주소 길이 제한을 넘는다.
  const cancelled = await must<{ cancels_transaction_id: string }[]>(
    db.from("transactions").select("cancels_transaction_id")
      .eq("kind", "cancel").not("cancels_transaction_id", "is", null)
      .gte("occurred_at", from.toISOString())
      .lt("occurred_at", new Date(to.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString()),
  );

  return {
    txs,
    members,
    categoryNames: categories.names,
    categoryChoices: categories.choices,
    cancelledIds: new Set(cancelled.map((c) => c.cancels_transaction_id)),
    budgets,
    warnRatio: Number(warn.data.value),
    hiddenIds: categories.hiddenIds,
  };
}

/** 확인할 문자(가계부가 못 읽은 문자) 전부, 최근 것부터 */
export async function loadUnparsed(db: SupabaseClient) {
  return must<{ id: string; body: string; user_id: string; received_at: string }[]>(
    db.from("raw_messages").select("id, body, user_id, received_at").eq("status", "unparsed").order("received_at", { ascending: false }),
  );
}
