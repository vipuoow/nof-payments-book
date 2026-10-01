"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createGroup, createGroupInvite, revokeGroupInvite } from "@/auth/groups";
import { errorMessage } from "@/auth/messages";
import type { SecretState } from "@/components/one-time-secret-form";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function createGroupAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const result = await createGroup(supabase, String(formData.get("name") ?? ""));
  if (!result.ok) redirect(`/group/new?error=${result.reason}`);
  redirect("/group");
}

export async function createGroupInviteAction(): Promise<SecretState> {
  const supabase = await createSupabaseServerClient();
  const result = await createGroupInvite(supabase);
  if (!result.ok) return { error: errorMessage(result.reason) };
  revalidatePath("/group");
  return { value: `${process.env.APP_URL}/invite/${result.value.token}` };
}

export async function revokeGroupInviteAction(inviteId: string) {
  const supabase = await createSupabaseServerClient();
  await revokeGroupInvite(supabase, inviteId);
  revalidatePath("/group");
}
