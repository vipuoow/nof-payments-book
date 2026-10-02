import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { loadMembers } from "@/ledger/queries";
import { loadMe } from "@/lib/session";
import { ignoreRawAction } from "./actions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function UnparsedPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const [{ data, error }, members] = await Promise.all([
    supabase.from("raw_messages").select("id, body, user_id, received_at")
      .eq("status", "unparsed").order("received_at", { ascending: false }),
    loadMembers(supabase, me.groupId),
  ]);
  if (error) throw error;
  const names = new Map(members.map((m) => [m.userId, m.name]));

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">‹ 홈</Link>
        <h1 className="font-semibold">확인할 문자</h1>
        <span className="w-8" />
      </header>
      {data.length === 0 ? (
        <p className="py-12 text-center text-muted">확인할 문자가 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((r) => (
            <li key={r.id} data-testid="raw-item" className="rounded-xl bg-surface p-3">
              <p className="mb-2 text-xs text-muted">{names.get(r.user_id) ?? ""} · {when(r.received_at)}</p>
              <pre className="whitespace-pre-wrap font-sans text-sm">{r.body}</pre>
              <div className="mt-3 flex items-center justify-end gap-4 text-sm">
                <ActionButton action={ignoreRawAction.bind(null, r.id)} label="무시" className="text-muted" />
                <Link href={`/new?raw=${r.id}`} className="text-accent">거래로 등록</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
