import Link from "next/link";
import { redirect } from "next/navigation";
import { revokeGroupInviteAction } from "@/app/group/actions";
import { kstMonthDay } from "@/auth/invite-text";
import { PartnerInvite } from "@/components/partner/partner-invite";
import { loadSetup } from "@/ledger/setup";
import { loadMe } from "@/lib/session";

const MAX_MEMBERS = 2;

/** 파트너 잡으러 가기: 그룹장만, 파트너가 들어오기 전에만 */
export default async function PartnerPage({ searchParams }: PageProps<"/partner">) {
  const { supabase, me } = await loadMe();
  if (!me.groupId || me.role !== "owner") redirect("/");
  const setup = await loadSetup(supabase);
  if (setup.memberCount >= MAX_MEMBERS) redirect("/");
  const first = (await searchParams).first === "1";

  const { data: pending } = await supabase
    .from("group_invites")
    .select("id, invitee_name, expires_at")
    .is("used_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const expired = pending ? new Date(pending.expires_at) <= new Date() : false;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6">
      <header className="flex items-center py-3">
        <Link href="/" aria-label="홈" className="px-1 text-2xl text-muted">‹</Link>
      </header>
      <PartnerInvite
        me={me.displayName}
        first={first}
        pending={pending ? { name: pending.invitee_name ?? "가족", until: kstMonthDay(pending.expires_at), expired } : null}
        cancel={pending && !expired ? revokeGroupInviteAction.bind(null, pending.id) : null}
      />
    </main>
  );
}
