import Link from "next/link";
import { redirect } from "next/navigation";
import { DeviceSetup } from "@/components/devices/device-setup";
import { DEVICE_LABEL, parseDevice, tokenHealth, type Device } from "@/ledger/devices";
import { loadMe } from "@/lib/session";
import { revokeTokenAction } from "./actions";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음");
const HEALTH_TEXT = {
  never: "아직 받은 문자가 없습니다.",
  stale: "3일 넘게 문자가 오지 않았습니다. 설정을 확인해 주세요.",
  ok: null,
} as const;

export default async function DevicesPage({ searchParams }: PageProps<"/devices">) {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const device = parseDevice((await searchParams).device);
  const { data: tokens } = await supabase
    .from("ingest_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">‹ 홈</Link>
        <h1 className="font-semibold">내 기기 연결</h1>
        <span className="w-8" />
      </header>
      <nav className="grid grid-cols-2 rounded-xl bg-surface p-1 text-center text-sm">
        {(["iphone", "android"] as Device[]).map((d) => (
          <Link
            key={d}
            href={`/devices?device=${d}`}
            replace
            aria-current={d === device ? "page" : undefined}
            className={`rounded-lg py-2 ${d === device ? "bg-background font-semibold shadow" : "text-muted"}`}
          >
            {DEVICE_LABEL[d]}
          </Link>
        ))}
      </nav>

      {/* 토큰은 기종과 무관하므로 탭을 바꿔도 발급 상태(방금 받은 토큰)를 유지한다 */}
      <DeviceSetup device={device} appUrl={process.env.APP_URL ?? ""} />

      <h2 className="mt-8 mb-2 font-semibold">내 기기</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {(tokens ?? []).map((t) => {
          const health = t.revoked_at ? null : HEALTH_TEXT[tokenHealth(t.last_used_at, now)];
          return (
            <li key={t.id} className="rounded-xl bg-surface p-3">
              <div className="font-semibold">
                {t.label || "(이름 없음)"} {t.revoked_at && <span className="text-danger">폐기됨</span>}
              </div>
              <div className="text-muted">발급 {fmt(t.created_at)} · 마지막 수신 {fmt(t.last_used_at)}</div>
              {health && <p className="mt-1 text-warning">{health}</p>}
              {!t.revoked_at && (
                <form action={revokeTokenAction.bind(null, t.id)} className="mt-1">
                  <button className="text-danger">폐기</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
