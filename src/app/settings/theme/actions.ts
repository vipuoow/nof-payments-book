"use server";

import { revalidatePath } from "next/cache";
import { loadMe } from "@/lib/session";
import { THEMES, type Theme } from "@/lib/theme";
import { writeThemeCookie } from "@/lib/theme-server";

/** 화면 모드 저장: 내 프로필(사람마다)과 이 기기의 쿠키 */
export async function setThemeAction(theme: Theme): Promise<{ ok: boolean }> {
  if (!(THEMES as readonly string[]).includes(theme)) return { ok: false };
  const { supabase, me } = await loadMe();
  const { error } = await supabase.from("profiles").update({ theme }).eq("user_id", me.userId);
  if (error) return { ok: false };
  await writeThemeCookie(theme);
  revalidatePath("/", "layout");
  return { ok: true };
}
