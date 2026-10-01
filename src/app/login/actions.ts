"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Google 로그인 화면으로 보낸다. 돌아오면 /auth/callback이 세션을 만들고 next로 이동시킨다. */
export async function signInWithGoogle(next: string) {
  const supabase = await createSupabaseServerClient();
  const redirectTo = `${process.env.APP_URL}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error || !data.url) redirect("/login?error=login_failed");
  redirect(data.url);
}
