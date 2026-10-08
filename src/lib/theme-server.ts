import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme, themeOf } from "./theme";

export async function writeThemeCookie(theme: Theme) {
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: THEME_COOKIE_MAX_AGE,
  });
}

/** 로그인 직후: 이 사람이 고른 화면 모드를 쿠키에 맞춘다(다른 기기에서 바꾼 것도 따라온다) */
export async function syncThemeCookie(supabase: SupabaseClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase.from("profiles").select("theme").eq("user_id", user.id).maybeSingle();
  if (data) await writeThemeCookie(themeOf(data.theme));
}
