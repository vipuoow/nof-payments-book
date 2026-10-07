import Link from "next/link";
import { signOut } from "@/app/actions";
import { createGroupAction } from "@/app/group/actions";
import { errorMessage } from "@/auth/messages";
import type { Me } from "@/lib/session";

/** 가계부가 아직 없는 사람의 홈: 가계부 만들기(내 닉네임). 만들 권한이 없으면 초대 링크를 받으라고 안내한다. */
export function NoGroup({ me, error }: { me: Me; error?: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6">
      <section className="flex flex-1 flex-col gap-3 px-2 pt-16">
        <h1 className="text-2xl font-bold leading-snug">{me.displayName}님, 반가워요</h1>
        {me.canCreateGroup ? (
          <form id="create-group" action={createGroupAction} className="flex flex-col gap-3">
            <p className="text-muted">가계부에서 나를 부를 닉네임을 정하고<br />가계부를 만들어요.</p>
            <label className="mt-4 flex flex-col gap-1 text-sm text-muted">
              내 닉네임
              <input
                name="name"
                required
                maxLength={10}
                autoComplete="off"
                placeholder="예: 남편"
                className="border-b-2 border-accent bg-transparent py-3 text-lg text-foreground outline-none"
              />
            </label>
            <p className="text-sm text-muted">거래 목록과 합계에 이 닉네임이 붙어요. 나중에 바꿀 수 없어요.</p>
            {error && <p role="alert" className="text-sm text-danger">{errorMessage(error)}</p>}
          </form>
        ) : (
          <p className="text-muted">아직 함께 쓰는 가계부가 없어요.<br />가족에게 초대 링크를 받아 주세요.</p>
        )}
        {me.isOperator && <Link className="text-accent" href="/operator">운영자</Link>}
      </section>
      <div className="flex flex-col items-center gap-3">
        {me.canCreateGroup && (
          <button form="create-group" className="w-full rounded-2xl bg-accent py-4 font-semibold text-white">가계부 만들기</button>
        )}
        <form action={signOut}>
          <button className="text-sm text-muted">로그아웃</button>
        </form>
      </div>
    </main>
  );
}
