"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { budgetMonth, parseBudgetInput, TOTAL } from "@/ledger/budget";
import { isUuid } from "@/ledger/forms";
import { kstMonthOf } from "@/ledger/month";
import { loadMe } from "@/lib/session";

export type BudgetFormState = { error?: string; errors?: Record<string, string>; values?: Record<string, string> } | null;

const FAIL = "저장하지 못했습니다. 다시 시도해 주세요.";

/**
 * 사용자가 손댄 칸(화면을 연 때의 값 o:<key>와 다른 칸)만 이번 달(KST) 1일로 저장한다. 비운 칸은 0(이 달부터 없음).
 * DB의 현재 값과 비교하면, 열어 둔 화면이 그사이 다른 사람이 바꾼 칸을 되돌린다.
 */
export async function saveBudgetsAction(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const inputs = new Map<string, number | null>();
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("b:") || typeof value !== "string") continue;
    const key = name.slice(2);
    if (key !== TOTAL && !isUuid(key)) continue;
    values[name] = value;
    const parsed = parseBudgetInput(value);
    if (parsed.ok) inputs.set(key, parsed.amount);
    else errors[name] = parsed.error;
  }
  if (Object.keys(errors).length > 0) return { errors, values };

  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL, values };
  const month = kstMonthOf(new Date());

  const rows = [];
  for (const [key, amount] of inputs) {
    const original = parseBudgetInput(String(formData.get(`o:${key}`) ?? ""));
    const before = original.ok ? original.amount : null;
    if (amount === before || (amount === null && before === null)) continue;
    rows.push({
      group_id: me.groupId,
      category_id: key === TOTAL ? null : key,
      month: budgetMonth(month),
      amount: amount ?? 0,
    });
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("budgets").upsert(rows, { onConflict: "group_id,category_id,month" });
    if (error) return { error: FAIL, values };
  }
  revalidatePath("/");
  revalidatePath("/budget");
  redirect("/", RedirectType.replace);
}
