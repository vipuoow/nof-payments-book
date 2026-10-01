import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Google 로그인 후 돌아와 PKCE 코드를 세션으로 바꾸고, 원래 가려던 경로로 보낸다. */
export async function GET(request: NextRequest) {
  const base = process.env.APP_URL!;
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, base));
  }
  return NextResponse.redirect(new URL("/login?error=login_failed", base));
}
