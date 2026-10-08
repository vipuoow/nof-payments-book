"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { THEME_COOKIE } from "@/lib/theme";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // 로그인 화면은 기본 모드로(같은 휴대폰에서 다른 사람이 로그인해도 그 사람 모드로 다시 맞춘다)
  (await cookies()).delete(THEME_COOKIE);
  redirect("/login");
}
