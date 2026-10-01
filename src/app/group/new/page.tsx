import { redirect } from "next/navigation";
import { errorMessage } from "@/auth/messages";
import { loadMe } from "@/lib/session";
import { createGroupAction } from "../actions";

export default async function NewGroupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { me } = await loadMe();
  if (me.groupId) redirect("/group");
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">그룹 만들기</h1>
      {error && <p className="mb-3 text-red-600">{errorMessage(error)}</p>}
      {me.canCreateGroup ? (
        <form action={createGroupAction} className="flex flex-col gap-3">
          <input name="name" required placeholder="그룹 이름 (예: 우리집 가계부)" className="rounded border p-2" />
          <button className="rounded bg-black p-2 text-white">만들기</button>
        </form>
      ) : (
        <p>{errorMessage("not_allowed")}</p>
      )}
    </main>
  );
}
