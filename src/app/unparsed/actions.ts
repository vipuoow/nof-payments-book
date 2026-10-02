"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/tx-actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function ignoreRawAction(rawId: string): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("raw_messages").update({ status: "ignored" })
    .eq("id", rawId).eq("status", "unparsed").select("id");
  if (error) return { error: "저장하지 못했습니다. 다시 시도해 주세요." };
  if (data.length === 0) return { error: "이미 처리된 문자입니다." };
  revalidatePath("/unparsed");
  revalidatePath("/");
  return null;
}
