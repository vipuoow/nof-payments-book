"use client";

import { useActionState, useState } from "react";
import { createServiceInviteAction, type ServiceInviteState } from "@/app/operator/actions";
import { copyText, deliver, type Sent } from "@/lib/share";

/** 서비스 초대 링크: 만들면 잘 보이는 카드로 보여 주고 [보내기]·[링크 복사] */
export function InviteCard() {
  const [state, formAction, pending] = useActionState<ServiceInviteState>(createServiceInviteAction, null);
  const [sent, setSent] = useState<Sent | null>(null);
  const ok = state && "url" in state ? state : null;
  return (
    <section className="card flex flex-col gap-3">
      <h2 className="font-semibold">서비스 초대</h2>
      <p className="text-sm text-muted">링크를 받은 사람은 가입한 뒤 가계부를 만들어 그룹장이 돼요. 7일 동안, 한 번만 쓸 수 있어요.</p>
      {ok ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-4">
          <p className="text-sm font-semibold text-accent">초대 링크가 준비됐어요 · {ok.until}까지</p>
          <p data-testid="invite-link" className="select-all break-all rounded-xl bg-surface px-3 py-2 font-mono text-sm text-foreground">{ok.url}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={async () => setSent(await deliver(ok.text, true))} className="rounded-xl bg-accent py-3 font-semibold text-white">카카오톡·문자로 보내기</button>
            <button type="button" onClick={async () => setSent(await copyText(ok.text))} className="rounded-xl bg-surface py-3 font-semibold text-foreground">링크 복사</button>
          </div>
          {sent === "copied" && <p role="status" className="text-sm text-ok">링크를 복사했어요. 카카오톡이나 문자에 붙여넣어 보내 주세요.</p>}
          {sent === "shared" && <p role="status" className="text-sm text-ok">보냈어요.</p>}
          {sent === "manual" && <p role="status" className="text-sm text-muted">위 링크를 길게 눌러 복사해 주세요.</p>}
          <form action={formAction}><button disabled={pending} className="w-full py-2 text-sm text-muted disabled:opacity-50">새 링크 만들기</button></form>
        </div>
      ) : (
        <form action={formAction}>
          <button disabled={pending} className="w-full rounded-2xl bg-accent py-4 font-semibold text-white disabled:opacity-50">서비스 초대 링크 만들기</button>
          {state && "error" in state && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
        </form>
      )}
    </section>
  );
}
