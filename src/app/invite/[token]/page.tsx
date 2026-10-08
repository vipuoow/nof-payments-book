import { defaultDisplayName } from "@/auth/display-name";
import { getInviteStatus, inviteStatusError } from "@/auth/invites";
import { errorMessage } from "@/auth/messages";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { GoogleButton } from "@/components/landing/google-button";
import { Landing } from "@/components/landing/landing";
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
      <Landing path={`/invite/${encodeURIComponent(token)}`} error={errorMessage(inviteStatusError(status.status))}>
        <GoogleButton next="/" label="Google로 시작하기" />
      </Landing>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const inviter = status.inviterName ?? "가족";
  const here = `/invite/${encodeURIComponent(token)}`;

  if (!user) {
    return (
      <Landing path={here} note={`${inviter}님이 같이가계부에 초대했어요`} error={error ? errorMessage(error) : undefined}>
        <GoogleButton next={here} label="Google로 가입하기" />
        <p className="text-center text-xs text-white/75">가입하면 두 사람의 카드 결제가 한곳에 모여요.</p>
      </Landing>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-6 pb-6">
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
    </main>
  );
}
