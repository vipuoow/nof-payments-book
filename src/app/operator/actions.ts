"use server";

import { createServiceInvite } from "@/auth/groups";
import { errorMessage } from "@/auth/messages";
import type { SecretState } from "@/components/one-time-secret-form";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function createServiceInviteAction(): Promise<SecretState> {
  const supabase = await createSupabaseServerClient();
  const result = await createServiceInvite(supabase);
  if (!result.ok) return { error: errorMessage(result.reason) };
  return { value: `${process.env.APP_URL}/invite/${result.value.token}` };
}
