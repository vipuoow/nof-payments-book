"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPartnerInviteAction, type InviteState } from "@/app/group/actions";
import { deliver, type Sent } from "@/lib/share";

type Pending = { name: string; until: string; expired: boolean } | null;
type Made = (Exclude<InviteState, null | { error: string }> & { sent: Sent }) | { error: string } | null;

/**
 * 파트너 초대. 링크를 만들면 곧바로 휴대폰 공유 창(카카오톡·문자)을 띄운다.
 * 휴대폰은 버튼을 누른 직후에만 공유 창을 열어 주므로, 링크를 만드는 사이 막히면 [보내기] 버튼을 한 번 더 보여 준다.
 * 공유 창이 없는 브라우저는 클립보드로 복사하고, 그것도 막히면 링크 글자를 선택해 둔다.
 */
export function PartnerInvite({ me, first, pending, cancel }: {
  me: string; first: boolean; pending: Pending; cancel: (() => Promise<void>) | null;
}) {
  const [state, formAction, busy] = useActionState<Made, FormData>(async (_prev, formData) => {
    const made = await createPartnerInviteAction(null, formData);
    return made && "url" in made ? { ...made, sent: await deliver(made.text, false) } : made;
  }, null);
  const [resent, setResent] = useState<Sent | null>(null);
  const [making, setMaking] = useState(pending === null);
  const ok = state && "url" in state ? state : null;
  const sent = resent ?? ok?.sent ?? null;

  if (ok && sent && sent !== "retry") {
    return (
      <>
        <section className="flex flex-1 flex-col gap-3 px-2 pt-6">
          <h1 className="text-2xl font-bold">초대를 보냈어요</h1>
          <p className="text-muted">{ok.inviteeName}님이 링크로 가입하면<br />두 사람의 결제가 한곳에 모여요.</p>
          {sent === "copied" && <p role="status" className="text-sm text-ok">링크를 복사했어요. 카카오톡이나 문자에 붙여넣어 보내 주세요.</p>}
          {sent === "manual" && (
            <label className="text-sm text-muted">
              아래 링크를 길게 눌러 복사해 주세요.
              <input readOnly autoFocus value={ok.url} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg bg-surface px-3 py-2 text-base" />
            </label>
          )}
          <div className="card mt-2">
            <p className="font-semibold">{me}<span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">나 · 그룹장</span></p>
            <div className="mt-3 rounded-2xl bg-accent-soft px-4 py-3">
              <p className="font-semibold text-accent">{ok.inviteeName}님 초대를 기다리는 중</p>
              <p className="text-xs text-muted">링크는 7일 동안, 한 번만 쓸 수 있어요.</p>
            </div>
          </div>
        </section>
        <Link href="/" className="block rounded-2xl bg-accent py-4 text-center font-semibold text-white">홈으로 가기</Link>
      </>
    );
  }

  if (ok) {
    return (
      <>
        <section className="flex flex-1 flex-col gap-3 px-2 pt-6">
          <h1 className="text-2xl font-bold">{ok.inviteeName}님 초대 링크가 준비됐어요</h1>
          <p className="text-muted">아래 버튼으로 카카오톡이나 문자로 보내 주세요. 이 화면을 나가면 링크를 다시 볼 수 없어요.</p>
        </section>
        <button type="button" onClick={async () => setResent(await deliver(ok.text, true))} className="rounded-2xl bg-accent py-4 font-semibold text-white">
          카카오톡·문자로 보내기
        </button>
      </>
    );
  }

  if (pending && !making) {
    return (
      <>
        <section className="flex flex-1 flex-col gap-3 px-2 pt-6">
          <h1 className="text-2xl font-bold">파트너 잡으러 가기</h1>
          <div className="card mt-2">
            <p className="font-semibold">{me}<span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">나 · 그룹장</span></p>
            {pending.expired ? (
              <div className="mt-3 rounded-2xl bg-danger/10 px-4 py-3">
                <p className="font-semibold text-danger">{pending.name}님 초대 링크가 만료됐어요</p>
                <p className="text-xs text-muted">7일이 지났어요. 새 링크를 만들어 다시 보내 주세요.</p>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3">
                <div>
                  <p className="font-semibold text-accent">{pending.name}님 초대를 기다리는 중</p>
                  <p className="text-xs text-muted">{pending.until}까지 쓸 수 있어요</p>
                </div>
                {cancel && (
                  <form action={cancel}>
                    <button className="shrink-0 text-sm text-danger">취소</button>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setMaking(true)} className="rounded-2xl bg-accent py-4 font-semibold text-white">
            {pending.expired ? "초대 링크 다시 만들기" : "새 링크 만들어 다시 보내기"}
          </button>
          {!pending.expired && <p className="text-center text-xs text-muted">새 링크를 만들면 이전 링크는 쓸 수 없게 돼요.</p>}
        </div>
      </>
    );
  }

  return (
    <>
      <form id="invite" action={formAction} className="flex flex-1 flex-col gap-3 px-2 pt-6">
        <h1 className="text-2xl font-bold">{first ? "가계부를 만들었어요" : "파트너 잡으러 가기"}</h1>
        <p className="text-muted">함께 쓸 가족을 초대해 주세요. 두 사람의 결제가 한곳에 모여요.</p>
        <div className="card mt-2 flex flex-col gap-3">
          <p className="font-semibold">{me}<span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">나 · 그룹장</span></p>
          <label className="flex flex-col gap-1 text-sm text-muted">
            초대할 가족의 닉네임
            <input name="name" required maxLength={10} autoComplete="off" placeholder="예: 아내"
              className="border-b-2 border-accent bg-transparent py-3 text-lg text-foreground outline-none" />
          </label>
          <p className="text-xs text-muted">가족은 이 닉네임으로 가계부에 들어와요. 정한 닉네임은 나중에 바꿀 수 없어요.</p>
        </div>
        {state && "error" in state && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      </form>
      <div className="flex flex-col items-center gap-2">
        <button form="invite" disabled={busy} className="w-full rounded-2xl bg-accent py-4 font-semibold text-white disabled:opacity-50">
          초대 링크 만들기
        </button>
        {first && <Link href="/" className="py-2 text-sm text-muted">나중에 할게요</Link>}
        <p className="text-xs text-muted">링크는 7일 동안, 한 번만 쓸 수 있어요.</p>
      </div>
    </>
  );
}
