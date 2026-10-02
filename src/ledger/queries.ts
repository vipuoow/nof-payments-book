import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryOptions, type CategoryRow } from "@/categorize/categorize";
import { monthRange, type Month } from "./month";
import type { CategorySource, LedgerTx, Member, TxKind } from "./summary";

export type CategoryLite = { id: string; name: string };
export type MonthData = {
  txs: LedgerTx[];
  members: Member[];
  categoryNames: Map<string, string>;
  categoryChoices: CategoryLite[];
  cancelledIds: Set<string>;
  unparsedCount: number;
};

const TX_COLUMNS =
  "id, user_id, kind, amount, merchant, occurred_at, category_id, category_source, cancels_transaction_id, memo, raw_message_id";

type TxRow = {
  id: string; user_id: string; kind: TxKind; amount: number; merchant: string; occurred_at: string;
  category_id: string | null; category_source: CategorySource; cancels_transaction_id: string | null;
  memo: string; raw_message_id: string | null;
};

function toLedgerTx(r: TxRow): LedgerTx {
  return {
    id: r.id, userId: r.user_id, kind: r.kind, amount: Number(r.amount), merchant: r.merchant,
    occurredAt: new Date(r.occurred_at), categoryId: r.category_id, categorySource: r.category_source,
    cancelsTransactionId: r.cancels_transaction_id, memo: r.memo, rawMessageId: r.raw_message_id,
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

/** 보이는 카테고리(기본 + 내 그룹, RLS). 버튼용은 이름이 겹치면 그룹 것만. */
export async function loadCategories(db: SupabaseClient) {
  const rows = await must<CategoryRow[]>(
    db.from("categories").select("id, name, group_id").order("sort_order").order("name"),
  );
  return {
    names: new Map(rows.map((r) => [r.id, r.name])),
    choices: categoryOptions(rows).map(({ id, name }) => ({ id, name })),
  };
}

export async function loadMonth(db: SupabaseClient, groupId: string, month: Month): Promise<MonthData> {
  const { from, to } = monthRange(month);
  const [rows, members, categories, unparsed] = await Promise.all([
    must<TxRow[]>(
      db.from("transactions").select(TX_COLUMNS)
        .gte("occurred_at", from.toISOString()).lt("occurred_at", to.toISOString())
        .order("occurred_at", { ascending: false }),
    ),
    loadMembers(db, groupId),
    loadCategories(db),
    db.from("raw_messages").select("id", { count: "exact", head: true }).eq("status", "unparsed"),
  ]);
  if (unparsed.error) throw unparsed.error;

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
    unparsedCount: unparsed.count ?? 0,
  };
}

/** 거래 하나와 마스킹된 원문. 내 그룹 것이 아니면(RLS) null. */
export async function loadTransaction(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("transactions")
    .select(`${TX_COLUMNS}, raw_messages(body)`).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const raw = (data as unknown as { raw_messages: { body: string } | null }).raw_messages;
  return { tx: toLedgerTx(data as unknown as TxRow), rawBody: raw?.body ?? null };
}

/** 미분류 문자 하나. 내 그룹의 unparsed가 아니면 null. */
export async function loadRawMessage(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("raw_messages")
    .select("id, body, user_id, received_at").eq("id", id).eq("status", "unparsed").maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, body: data.body, userId: data.user_id, receivedAt: new Date(data.received_at) } : null;
}
