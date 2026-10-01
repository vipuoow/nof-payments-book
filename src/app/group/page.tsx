import Link from "next/link";
import { redirect } from "next/navigation";
import { OneTimeSecretForm } from "@/components/one-time-secret-form";
import { loadMe } from "@/lib/session";
import { createGroupInviteAction, revokeGroupInviteAction } from "./actions";

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

export default async function GroupPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect(me.canCreateGroup ? "/group/new" : "/");

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, role, profiles(display_name)")
    .eq("group_id", me.groupId);
  const { data: invites } = me.role === "owner"
    ? await supabase.from("group_invites").select("id, expires_at, used_at, revoked_at, created_at").order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href="/" className="text-sm underline">← 홈</Link>
      <h1 className="my-4 text-xl font-bold">우리 가계부</h1>
      <h2 className="mb-2 font-semibold">구성원</h2>
      <ul className="mb-6 list-disc pl-5">
        {(members ?? []).map((m) => (
          <li key={m.user_id}>
            {(m.profiles as unknown as { display_name: string } | null)?.display_name} {m.role === "owner" && "(그룹장)"}
          </li>
        ))}
      </ul>

      {me.role === "owner" && (
        <>
          <h2 className="mb-2 font-semibold">초대</h2>
          <OneTimeSecretForm action={createGroupInviteAction} buttonLabel="초대 링크 만들기" valueLabel="초대 링크" />
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {(invites ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded border p-2">
                <span>
                  {fmt(i.created_at)} ·{" "}
                  {i.used_at ? "사용됨" : i.revoked_at ? "취소됨" : new Date(i.expires_at) < new Date() ? "만료" : `~${fmt(i.expires_at)}`}
                </span>
                {!i.used_at && !i.revoked_at && (
                  <form action={revokeGroupInviteAction.bind(null, i.id)}>
                    <button className="text-red-600 underline">취소</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
