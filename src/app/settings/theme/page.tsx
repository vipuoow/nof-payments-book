import Link from "next/link";
import { ThemePicker } from "@/components/settings/theme-picker";
import { loadMe } from "@/lib/session";
import { themeOf } from "@/lib/theme";

export default async function ThemePage() {
  const { supabase, me } = await loadMe();
  const { data } = await supabase.from("profiles").select("theme").eq("user_id", me.userId).single();
  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="grid grid-cols-[44px_1fr_44px] items-center py-3">
        <Link href="/" aria-label="홈" className="nav-icon"><svg viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" /></svg></Link>
        <h1 className="text-center font-semibold">화면 모드</h1>
      </header>
      <p className="mb-4 px-1 text-sm text-muted">나에게만 적용돼요. 같이 쓰는 사람은 각자 고를 수 있어요.</p>
      <ThemePicker current={themeOf(data?.theme)} />
    </main>
  );
}
