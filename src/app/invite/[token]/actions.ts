"use server";

import { redirect } from "next/navigation";
import { defaultDisplayName } from "@/auth/display-name";
import { acceptInvite } from "@/auth/invites";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * 로그인한 사용자가 초대를 수락한다. 이름은 입력받지 않는다:
 * 그룹 초대는 그룹장이 정한 닉네임, 서비스 초대는 Google 이름을 쓴다(가계부를 만들 때 닉네임을 정한다).
 */
export async function acceptInviteAction(token: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const accepted = await acceptInvite(supabase, token, user ? defaultDisplayName(user) : "");
  if (!accepted.ok) redirect(`/invite/${encodeURIComponent(token)}?error=${accepted.reason}`);
  redirect("/");
}
