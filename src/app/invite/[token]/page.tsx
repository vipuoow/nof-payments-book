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
  const inviter = status.inviterName ?? "가족";
  const here = `/invite/${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto w-full max-w-[480px] px-6 pb-6">
      {user ? (
        <form action={acceptInviteAction.bind(null, token)} className="flex min-h-[70dvh] flex-col">
          <section className="flex flex-1 flex-col gap-3 pt-10">
            {status.kind === "group" ? (
              <>
                <h1 className="text-2xl font-bold leading-snug">같이가계부에서<br />‘{status.inviteeName ?? defaultDisplayName(user)}’로 함께 써요</h1>
                <p className="text-muted">닉네임은 {inviter}님이 정했어요.</p>
              </>
            ) : (
              <h1 className="text-2xl font-bold leading-snug">같이가계부에 오신 걸 환영해요</h1>
            )}
            <p className="text-sm text-muted">{user.email} 계정으로 들어가요.</p>
            {error && <p role="alert" className="text-sm text-danger">{errorMessage(error)}</p>}
          </section>
          <button className="rounded-2xl bg-accent py-4 font-semibold text-white">시작하기</button>
        </form>
      ) : (
        <form action={signInWithGoogle.bind(null, here)} className="flex flex-col gap-3 pt-10">
          <h1 className="text-2xl font-bold leading-snug">{inviter}님이 같이가계부에 초대했어요</h1>
          {error && <p role="alert" className="text-sm text-danger">{errorMessage(error)}</p>}
          <button className="w-full rounded-2xl bg-surface py-4 font-semibold">Google로 가입하기</button>
        </form>
      )}
    </main>
  );
}
