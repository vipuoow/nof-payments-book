"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/auth/invites";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 로그인한 사용자가 초대를 수락한다. 서비스 초대면 그룹 만들기로, 그룹 초대면 홈으로. */
export async function acceptInviteAction(token: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const supabase = await createSupabaseServerClient();
  const accepted = await acceptInvite(supabase, token, name);
  if (!accepted.ok) redirect(`/invite/${encodeURIComponent(token)}?error=${accepted.reason}`);
  redirect(accepted.value.kind === "service" ? "/group/new" : "/");
}
