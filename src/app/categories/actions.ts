"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/tx-actions";
import { validateCategoryName } from "@/ledger/categories";
import { loadMe } from "@/lib/session";

const FAIL = "저장하지 못했습니다. 다시 시도해 주세요.";

function refresh() {
  revalidatePath("/categories");
  revalidatePath("/");
  revalidatePath("/budget");
}

/** 지금 보이는 모든 카테고리 이름(기본 + 우리 그룹), 바꾸는 중인 것은 뺀다 */
async function takenNames(exceptId?: string): Promise<string[]> {
  const { supabase } = await loadMe();
  const { data, error } = await supabase.from("categories").select("id, name");
  if (error) throw error;
  return data.filter((c) => c.id !== exceptId).map((c) => c.name);
}

export async function addCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("name") ?? "");
  const checked = validateCategoryName(raw, await takenNames());
  if (!checked.ok) return { error: checked.error, values: { name: raw } };
  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL, values: { name: raw } };
  const { data: last } = await supabase.from("categories").select("sort_order")
    .eq("group_id", me.groupId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("categories").insert({
    group_id: me.groupId, name: checked.name, sort_order: Math.max(10, (last?.sort_order ?? 9) + 1),
  });
  if (error) return { error: error.code === "23505" ? "이미 있는 이름입니다." : FAIL, values: { name: raw } };
  refresh();
  return null;
}

export async function renameCategoryAction(categoryId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("name") ?? "");
  const checked = validateCategoryName(raw, await takenNames(categoryId));
  if (!checked.ok) return { error: checked.error, values: { name: raw } };
  const { supabase, me } = await loadMe();
  const { data, error } = await supabase.from("categories").update({ name: checked.name })
    .eq("id", categoryId).eq("group_id", me.groupId ?? "").select("id");
  if (error) return { error: error.code === "23505" ? "이미 있는 이름입니다." : FAIL, values: { name: raw } };
  if (data.length === 0) return { error: FAIL, values: { name: raw } };
  refresh();
  return null;
}

/** 거래는 미지정(트리거가 출처도 비움), 규칙·예산은 FK로 함께 삭제된다. */
export async function deleteCategoryAction(categoryId: string): Promise<ActionState> {
  const { supabase, me } = await loadMe();
  const { data, error } = await supabase.from("categories").delete()
    .eq("id", categoryId).eq("group_id", me.groupId ?? "").select("id");
  if (error || data.length === 0) return { error: FAIL };
  refresh();
  return null;
}

export async function setHiddenAction(categoryId: string, hidden: boolean): Promise<ActionState> {
  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL };
  const { error } = hidden
    ? await supabase.from("category_hidden").upsert({ group_id: me.groupId, category_id: categoryId }, { ignoreDuplicates: true })
    : await supabase.from("category_hidden").delete().eq("group_id", me.groupId).eq("category_id", categoryId);
  if (error) return { error: FAIL };
  refresh();
  return null;
}

export async function deleteRuleAction(ruleId: string): Promise<ActionState> {
  const { supabase } = await loadMe();
  const { data, error } = await supabase.from("merchant_rules").delete().eq("id", ruleId).select("id");
  if (error || data.length === 0) return { error: FAIL };
  refresh();
  return null;
}
