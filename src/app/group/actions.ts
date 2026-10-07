"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createGroup, createGroupInvite, revokeGroupInvite } from "@/auth/groups";
import { inviteShareText } from "@/auth/invite-text";
import { errorMessage } from "@/auth/messages";
import { loadMe } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 가계부 만들기: 내 닉네임을 함께 저장하고 파트너 초대로 간다 */
export async function createGroupAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const result = await createGroup(supabase, String(formData.get("name") ?? ""));
  if (!result.ok) redirect(`/?error=${result.reason}`);
  redirect("/partner?first=1");
}

export type InviteState = { url: string; text: string; inviteeName: string } | { error: string } | null;

/** 파트너 초대 링크를 만들고, 공유 창에 넣을 문구를 돌려준다(링크는 이때만 알 수 있다) */
export async function createPartnerInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const { supabase, me } = await loadMe();
  const inviteeName = String(formData.get("name") ?? "").trim();
  const result = await createGroupInvite(supabase, inviteeName);
  if (!result.ok) return { error: errorMessage(result.reason) };
  revalidatePath("/partner");
  const url = `${process.env.APP_URL}/invite/${result.value.token}`;
  return { url, text: inviteShareText(me.displayName, result.value.expiresAt, url), inviteeName };
}

export async function revokeGroupInviteAction(inviteId: string) {
  const supabase = await createSupabaseServerClient();
  await revokeGroupInvite(supabase, inviteId);
  revalidatePath("/partner");
}
