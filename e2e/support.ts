import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { PASSWORD, adminClient, createGroupFixture, type GroupFixture } from "../tests/helpers/db";

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

/** 같은 형식에서 일시만 바꾼 문자 */
export const at = (body: string, mmddHhmm: string) => body.replace(/\d{2}\/\d{2} \d{2}:\d{2}/, mmddHhmm);
/** 지금으로부터 minutesAgo분 전의 KST "MM/DD HH:mm". 자정 무렵에도 미래 시각이 되지 않는다. */
export function kstStamp(minutesAgo: number, now = new Date()): string {
  const k = new Date(now.getTime() - minutesAgo * 60_000 + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(k.getUTCMonth() + 1)}/${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}

/**
 * 처음 홈 단계(휴대폰 연결 → 한도 정하기)를 마친 가계부. 평소 홈을 시험하는 테스트가 쓴다.
 * 그룹장 휴대폰에서 문자가 도착한 것으로 하고, 아주 오래전 달에 큰 전체 한도를 넣어 둔다
 * (이번 달이나 지난달에 한도를 넣는 테스트가 있으면 그 값이 이긴다).
 */
export async function readyGroupFixture(label: string): Promise<GroupFixture> {
  const g = await createGroupFixture(label);
  const db = adminClient();
  await db.from("ingest_tokens").insert({
    user_id: g.owner.userId, token_hash: `ready-${g.groupId}`, label: "준비", last_used_at: new Date().toISOString(),
  });
  await db.from("budgets").insert({ group_id: g.groupId, category_id: null, month: "2000-01-01", amount: 100_000_000 });
  return g;
}
