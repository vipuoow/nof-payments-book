"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { budgetMonth, parseBudgetInput } from "@/ledger/budget";
import { limitRows, type LimitChoice } from "@/ledger/limit";
import { kstMonthOf } from "@/ledger/month";
import { loadMe } from "@/lib/session";

export type LimitState = { error?: string; value?: string } | null;

const FAIL = "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/**
 * 전체 한도 저장(설계 4.7). 이번 달부터 또는 다음 달부터만 받는다(지난 달은 바꿀 수 없다).
 * 처음 홈 2단계(first=1)는 이번 달부터로 고정한다.
 */
export async function saveLimitAction(_prev: LimitState, formData: FormData): Promise<LimitState> {
  const value = String(formData.get("amount") ?? "");
  const when = formData.get("first") === "1" ? "this" : String(formData.get("when") ?? "");
  if (when !== "this" && when !== "next") return { error: "적용할 달을 골라 주세요.", value };
  const parsed = parseBudgetInput(value);
  if (!parsed.ok) return { error: parsed.error, value };
  if (parsed.amount === null || parsed.amount <= 0) return { error: "한도를 1원 이상으로 정해 주세요.", value };

  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL, value };
  const now = new Date();
  const thisMonth = budgetMonth(kstMonthOf(now));
  const { data: latest, error: readError } = await supabase
    .from("budgets")
    .select("month, amount")
    .eq("group_id", me.groupId)
    .is("category_id", null)
    .lte("month", thisMonth)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) return { error: FAIL, value };

  const rows = limitRows(
    when as LimitChoice,
    now,
    { thisMonthRow: latest?.month === thisMonth, amount: latest && latest.amount > 0 ? latest.amount : null },
    parsed.amount,
    me.groupId,
  );
  const { error } = await supabase.from("budgets").upsert(rows, { onConflict: "group_id,category_id,month" });
  if (error) return { error: FAIL, value };
  revalidatePath("/");
  revalidatePath("/limit");
  redirect("/", RedirectType.replace);
}
