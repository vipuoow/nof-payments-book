import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/session";

export function AppMenu({ me }: { me: Me }) {
  const item = "rounded-lg px-3 py-2 active:bg-line";
  return (
    <details className="relative">
      <summary aria-label="메뉴" className="cursor-pointer list-none px-1 text-xl [&::-webkit-details-marker]:hidden">☰</summary>
      <nav className="absolute left-0 z-10 mt-2 flex w-48 flex-col rounded-xl bg-surface p-1 shadow-lg">
        <span className="px-3 py-2 text-sm text-muted">{me.displayName}님</span>
        <Link className={item} href="/group">그룹</Link>
        <Link className={item} href="/devices">내 기기 연결</Link>
        {me.isOperator && <Link className={item} href="/operator">운영자</Link>}
        <form action={signOut}>
          <button className={`${item} w-full text-left text-danger`}>로그아웃</button>
        </form>
      </nav>
    </details>
  );
}
