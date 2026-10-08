"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashNonce, newNonce } from "@/auth/nonce";
import { safeNextPath } from "@/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { syncThemeCookie } from "@/lib/theme-server";

const NONCE_COOKIE = "g_nonce";

/** Google 로그인 창을 띄우기 전: 1회용 값을 쿠키(5분)에 두고 해시를 돌려준다 */
export async function prepareGoogleNonce(): Promise<string> {
  const raw = newNonce();
  (await cookies()).set(NONCE_COOKIE, raw, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 300,
  });
  return hashNonce(raw);
}

/** Google이 준 ID 토큰으로 로그인한다. 1회용 값이 없거나 맞지 않으면 로그인 실패 화면으로 */
export async function signInWithIdTokenAction(credential: string, next: string) {
  const store = await cookies();
  const raw = store.get(NONCE_COOKIE)?.value;
  store.delete(NONCE_COOKIE);
  if (!raw || !credential) redirect("/login?error=login_failed");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce: raw });
  if (error) redirect("/login?error=login_failed");
  await syncThemeCookie(supabase);
  redirect(safeNextPath(next));
}
