import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 초대 수락 전 계정으로 로그인한 경우: 로그아웃하고 안내한다. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?error=no_profile", process.env.APP_URL));
}
