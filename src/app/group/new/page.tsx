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
          <p className="text-sm text-gray-600">그룹을 만들면 그룹장이 되고, 가족 한 명을 초대할 수 있습니다.</p>
          <button className="rounded bg-black p-2 text-white">만들기</button>
        </form>
      ) : (
        <p>{errorMessage("not_allowed")}</p>
      )}
    </main>
  );
}
