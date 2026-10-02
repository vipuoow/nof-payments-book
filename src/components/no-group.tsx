import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/session";

export function NoGroup({ me }: { me: Me }) {
  return (
    <main className="mx-auto w-full max-w-[480px] p-6">
      <h1 className="mb-1 text-xl font-bold">{me.displayName}님</h1>
      <p className="mb-6 text-muted">아직 그룹이 없습니다</p>
      <nav className="flex flex-col gap-2">
        {me.canCreateGroup && <Link className="text-accent" href="/group/new">그룹 만들기</Link>}
        {me.isOperator && <Link className="text-accent" href="/operator">운영자</Link>}
      </nav>
      <p className="mt-6 text-sm text-muted">가족에게 초대 링크를 받아 가입하면 같은 가계부를 함께 봅니다.</p>
      <form action={signOut} className="mt-8">
        <button className="text-sm text-muted">로그아웃</button>
      </form>
    </main>
  );
}
