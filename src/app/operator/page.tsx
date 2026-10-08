import Link from "next/link";
import { ChevronLeft } from "@/components/icons";
import { redirect } from "next/navigation";
import { operatorOverview } from "@/auth/operator";
import { GroupCard } from "@/components/operator/group-card";
import { GrouplessRow } from "@/components/operator/groupless-row";
import { InviteCard } from "@/components/operator/invite-card";
import { loadMe } from "@/lib/session";

/** 운영자 서비스 화면: 현황, 서비스 초대, 그룹(없애기), 가계부 없는 계정(지우기) */
export default async function OperatorPage() {
  const { supabase, me } = await loadMe();
  if (!me.isOperator) redirect("/");
  const o = await operatorOverview(supabase);

  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 pb-16">
      <header className="flex items-center py-3">
        <Link href="/" aria-label="홈" className="nav-icon"><ChevronLeft /></Link>
      </header>
      <h1 className="px-1 text-2xl font-bold">서비스 관리</h1>
      <section className="card grid grid-cols-3 gap-2 text-center">
        <div><p className="text-xs text-muted">사용자</p><p className="tabular text-lg font-bold">{o.users}<span className="text-sm font-normal text-muted"> / {o.maxUsers}</span></p></div>
        <div><p className="text-xs text-muted">그룹</p><p className="tabular text-lg font-bold">{o.groups.length}</p></div>
        <div><p className="text-xs text-muted">가계부 없음</p><p className="tabular text-lg font-bold">{o.groupless.length}</p></div>
      </section>
      <InviteCard />
      <section className="flex flex-col gap-2">
        <h2 className="px-1 font-semibold">그룹</h2>
        {o.groups.length === 0 ? <p className="px-1 text-sm text-muted">아직 그룹이 없어요.</p> : (
          <ul className="flex flex-col gap-2">{o.groups.map((g) => <GroupCard key={g.id} group={g} />)}</ul>
        )}
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="px-1 font-semibold">가계부 없는 계정</h2>
        <p className="px-1 text-xs text-muted">계정과 휴대폰 연결이 남아 있어서, 다시 초대받으면 연결 단계를 건너뛰어요. 확실히 떠난 사람만 지워 주세요.</p>
        {o.groupless.length === 0 ? <p className="px-1 py-2 text-sm text-muted">없어요.</p> : (
          <ul className="card divide-y divide-line !py-1">{o.groupless.map((a) => <GrouplessRow key={a.userId} account={a} />)}</ul>
        )}
      </section>
    </main>
  );
}
