import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConnectGuide } from "@/components/devices/connect-guide";
import { InAppNotice } from "@/components/in-app-notice";
import { parseDevice, tokenHealth } from "@/ledger/devices";
import { detectDevice } from "@/ledger/guide";
import { loadMe } from "@/lib/session";
import { revokeTokenAction } from "./actions";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음");
const HEALTH_TEXT = {
  never: "아직 받은 문자가 없어요.",
  stale: "3일 넘게 문자가 오지 않았어요. 설정을 확인해 주세요.",
  ok: null,
} as const;

export default async function DevicesPage({ searchParams }: PageProps<"/devices">) {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const param = (await searchParams).device;
  const device = param ? parseDevice(param) : detectDevice((await headers()).get("user-agent"));
  const { data: tokens } = await supabase
    .from("ingest_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });
  const now = new Date();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-10">
      <div className="pt-3"><InAppNotice path="/devices" reason="단축어 추가가 안 될 수 있어요(버튼이 눌리지 않아요)." /></div>
      {/* 기종이 바뀌면 안내를 처음부터 다시 그린다 */}
      <ConnectGuide key={device} device={device} appUrl={process.env.APP_URL ?? ""} />

      {(tokens ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 font-semibold">내 기기</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {(tokens ?? []).map((t) => {
              const health = t.revoked_at ? null : HEALTH_TEXT[tokenHealth(t.last_used_at, now)];
              return (
                <li key={t.id} className="card !p-4">
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
        </section>
      )}
    </main>
  );
}
