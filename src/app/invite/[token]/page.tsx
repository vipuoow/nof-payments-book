import { defaultDisplayName } from "@/auth/display-name";
import { getInviteStatus, inviteStatusError } from "@/auth/invites";
import { errorMessage } from "@/auth/messages";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { signInWithGoogle } from "../../login/actions";
import { acceptInviteAction } from "./actions";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const status = await getInviteStatus(createAdminClient(), token);

  if (status.status !== "valid") {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="mb-4 text-xl font-bold">초대</h1>
        <p className="text-red-600">{errorMessage(inviteStatusError(status.status))}</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const title =
    status.kind === "group"
      ? `${status.inviterName ?? "가족"}님이 가계부에 초대했습니다`
      : "가계부 서비스에 초대받았습니다";
  const here = `/invite/${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      {error && <p className="mb-3 text-red-600">{errorMessage(error)}</p>}
      {user ? (
        <form action={acceptInviteAction.bind(null, token)} className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">{user.email} 계정으로 수락합니다.</p>
          <label className="text-sm">
            가계부에 표시할 이름
            <input name="name" required defaultValue={defaultDisplayName(user)} className="mt-1 w-full rounded border p-2" />
          </label>
          <button className="rounded bg-black p-2 text-white">수락</button>
        </form>
      ) : (
        <form action={signInWithGoogle.bind(null, here)}>
          <button className="w-full rounded border p-2">Google로 가입</button>
        </form>
      )}
    </main>
  );
}
