"use server";

import { revalidatePath } from "next/cache";
import { issueIngestToken, revokeIngestToken } from "@/auth/groups";
import { errorMessage } from "@/auth/messages";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 한 번만 보여 줄 비밀값(연결 코드) 또는 오류 */
export type SecretState = { value?: string; error?: string } | null;

export async function issueTokenAction(_prev: SecretState, formData: FormData): Promise<SecretState> {
  const supabase = await createSupabaseServerClient();
  const result = await issueIngestToken(supabase, String(formData.get("label") ?? ""));
  if (!result.ok) return { error: errorMessage(result.reason) };
  revalidatePath("/devices");
  return { value: result.value.token };
}

export async function revokeTokenAction(tokenId: string) {
  const supabase = await createSupabaseServerClient();
  await revokeIngestToken(supabase, tokenId);
  revalidatePath("/devices");
}
