"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { safeNextPath } from "@/auth/paths";
import { isUuid, parseTxForm } from "@/ledger/forms";
import { kstMonthOf, monthParam } from "@/ledger/month";
import { loadMe } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * values: React 19는 액션이 끝나면 폼을 초기화하므로, 실패하면 입력값을 돌려줘 폼이 다시 채우게 한다.
 */
export type ActionState = { error?: string; values?: Record<string, string> } | null;

const FAIL = "저장하지 못했습니다. 다시 시도해 주세요.";
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
/** React 내부 필드($ACTION_…)를 뺀 입력값 */
const valuesOf = (formData: FormData) =>
  Object.fromEntries([...formData.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;

/** 카테고리 버튼: 규칙 학습·같은 달 일괄 적용은 DB 함수가 한다. */
export async function setCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_transaction_category", {
    p_transaction: text(formData, "txId"),
    p_category: text(formData, "categoryId") || null,
  });
  if (error) return { error: FAIL };
  revalidatePath("/");
  redirect(safeNextPath(text(formData, "returnTo")), RedirectType.replace);
}

/** 더 보기: 금액·가맹점·일시·사람·메모. 취소 거래는 음수를 유지한다. */
export async function updateTxAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseTxForm((name) => text(formData, name));
  if (!parsed.ok) return { error: parsed.error, values: valuesOf(formData) };
  const supabase = await createSupabaseServerClient();
  const txId = text(formData, "txId");
  const { data: current } = await supabase.from("transactions").select("kind").eq("id", txId).maybeSingle();
  if (!current) return { error: FAIL, values: valuesOf(formData) };
  const v = parsed.value;
  const { error } = await supabase.from("transactions").update({
    amount: current.kind === "cancel" ? -v.amount : v.amount,
    merchant: v.merchant,
    occurred_at: v.occurredAt.toISOString(),
    user_id: v.userId,
    memo: v.memo,
  }).eq("id", txId);
  if (error) return { error: FAIL, values: valuesOf(formData) };
  revalidatePath("/");
  redirect(safeNextPath(text(formData, "returnTo")), RedirectType.replace);
}

/** 수동 입력 거래만 삭제한다. */
export async function deleteTxAction(txId: string, returnTo: string): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("transactions").delete()
    .eq("id", txId).eq("kind", "manual").select("id");
  if (error || data.length === 0) return { error: FAIL };
  revalidatePath("/");
  redirect(safeNextPath(returnTo), RedirectType.replace);
}

/** 수동 입력. 미분류 문자에서 왔으면(rawId) 저장 뒤 문자 상태를 parsed로 바꾼다. */
export async function createTxAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseTxForm((name) => text(formData, name));
  if (!parsed.ok) return { error: parsed.error, values: valuesOf(formData) };
  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL, values: valuesOf(formData) };
  const v = parsed.value;
  const rawId = text(formData, "rawId");
  if (isUuid(rawId)) {
    const { data: raw } = await supabase.from("raw_messages").select("id").eq("id", rawId).eq("status", "unparsed").maybeSingle();
    if (!raw) return { error: "이미 처리된 문자입니다.", values: valuesOf(formData) };
  }
  const { error } = await supabase.from("transactions").insert({
    group_id: me.groupId,
    user_id: v.userId,
    kind: "manual",
    amount: v.amount,
    merchant: v.merchant,
    occurred_at: v.occurredAt.toISOString(),
    category_id: v.categoryId,
    memo: v.memo,
  });
  if (error) return { error: FAIL, values: valuesOf(formData) };

  if (isUuid(rawId)) {
    // 실패해도 거래는 이미 저장됐다. 문자가 목록에 남으면 사용자가 무시할 수 있다.
    const { error: rawError } = await supabase.from("raw_messages").update({ status: "parsed" })
      .eq("id", rawId).eq("status", "unparsed");
    if (rawError) console.warn(`[unparsed] 문자 ${rawId} 상태 변경 실패: ${rawError.message}`);
  }
  revalidatePath("/");
  revalidatePath("/unparsed");
  redirect(`/?month=${monthParam(kstMonthOf(v.occurredAt))}`, RedirectType.replace);
}
