import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { PASSWORD } from "../tests/helpers/db";

/**
 * 앱에는 이메일 로그인 화면이 없으므로, 로컬 Supabase의 비밀번호 로그인으로 세션을 만들어
 * 앱과 같은 형식(@supabase/ssr)의 쿠키를 브라우저에 넣는다.
 */
export async function signIn(context: BrowserContext, email: string): Promise<void> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value);
            else jar.delete(name);
          }
        },
      },
    },
  );
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  await context.addCookies(
    [...jar].map(([name, value]) => ({ name, value, domain: "127.0.0.1", path: "/", sameSite: "Lax" as const })),
  );
}

/** 오늘(KST) "MM/DD" */
export function todayMmdd(now = new Date()): string {
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${String(k.getUTCMonth() + 1).padStart(2, "0")}/${String(k.getUTCDate()).padStart(2, "0")}`;
}

/** 같은 형식에서 일시만 바꾼 문자 */
export const at = (body: string, mmddHhmm: string) => body.replace(/\d{2}\/\d{2} \d{2}:\d{2}/, mmddHhmm);
