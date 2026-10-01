import Link from "next/link";
import { redirect } from "next/navigation";
import { OneTimeSecretForm } from "@/components/one-time-secret-form";
import { loadMe } from "@/lib/session";
import { issueTokenAction, revokeTokenAction } from "./actions";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음");

export default async function DevicesPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const { data: tokens } = await supabase
    .from("ingest_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href="/" className="text-sm underline">← 홈</Link>
      <h1 className="my-4 text-xl font-bold">내 기기 연결</h1>
      <p className="mb-2 text-sm text-gray-600">
        단축어(아이폰)·MacroDroid(갤럭시)에서 <code>{process.env.APP_URL}/api/ingest</code>로 결제 문자를 보낼 때
        <code> Authorization: Bearer &lt;토큰&gt;</code> 헤더에 넣습니다. 기기별 자세한 설정 안내는 계획 3에서 추가합니다.
      </p>
      <OneTimeSecretForm action={issueTokenAction} buttonLabel="토큰 발급" valueLabel="기기 토큰">
        <input name="label" placeholder="기기 이름 (예: 내 아이폰)" className="rounded border p-2" />
      </OneTimeSecretForm>
      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {(tokens ?? []).map((t) => (
          <li key={t.id} className="rounded border p-2">
            <div className="font-semibold">{t.label || "(이름 없음)"} {t.revoked_at && <span className="text-red-600">폐기됨</span>}</div>
            <div>발급 {fmt(t.created_at)} · 마지막 수신 {fmt(t.last_used_at)}</div>
            {!t.revoked_at && (
              <form action={revokeTokenAction.bind(null, t.id)}>
                <button className="text-red-600 underline">폐기</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
