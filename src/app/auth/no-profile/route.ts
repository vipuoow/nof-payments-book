import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { THEME_COOKIE } from "@/lib/theme";

/** 초대 수락 전 계정으로 로그인한 경우: 로그아웃하고 안내한다. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/login?error=no_profile", process.env.APP_URL));
  // 로그인 화면은 기본 모드로(로그아웃과 같다)
  res.cookies.delete(THEME_COOKIE);
  return res;
}
