"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/tx-actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function ignoreRawAction(rawId: string): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("raw_messages").update({ status: "ignored" }).eq("id", rawId);
  if (error) return { error: "저장하지 못했습니다. 다시 시도해 주세요." };
  revalidatePath("/unparsed");
  revalidatePath("/");
  return null;
}
