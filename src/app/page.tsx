import Link from "next/link";
import { loadMe } from "@/lib/session";
import { signOut } from "./actions";

export default async function Home() {
  const { me } = await loadMe();
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-1 text-xl font-bold">{me.displayName}님</h1>
      <p className="mb-6 text-gray-600">
        {me.groupName ? `${me.groupName} (${me.role === "owner" ? "그룹장" : "그룹원"})` : "아직 그룹이 없습니다"}
      </p>
      <nav className="flex flex-col gap-2">
        {!me.groupId && me.canCreateGroup && <Link className="underline" href="/group/new">그룹 만들기</Link>}
        {me.groupId && <Link className="underline" href="/group">그룹</Link>}
        {me.groupId && <Link className="underline" href="/devices">내 기기 연결</Link>}
        {me.isOperator && <Link className="underline" href="/operator">운영자</Link>}
      </nav>
      <form action={signOut} className="mt-8">
        <button className="text-sm text-gray-500 underline">로그아웃</button>
      </form>
    </main>
  );
}
