"use server";

import { revalidatePath } from "next/cache";
import { issueIngestToken, revokeIngestToken } from "@/auth/groups";
import { errorMessage } from "@/auth/messages";
import type { SecretState } from "@/components/one-time-secret-form";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
