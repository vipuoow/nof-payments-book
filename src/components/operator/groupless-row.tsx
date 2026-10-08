"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction, type OpState } from "@/app/operator/actions";
import type { Groupless } from "@/auth/operator";

const day = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" });

/** 가계부 없는 계정: 확인 뒤 계정과 휴대폰 연결까지 지운다 */
export function GrouplessRow({ account }: { account: Groupless }) {
  const [asking, setAsking] = useState(false);
  const [state, formAction, pending] = useActionState<OpState>(deleteAccountAction.bind(null, account.userId), null);
  return (
    <li data-testid={`groupless-${account.userId}`} className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span><b>{account.name}</b> <span className="text-xs text-muted">{day(account.since)}부터 가계부 없음 · {account.connected ? "휴대폰 연결 있음" : "휴대폰 연결 없음"}</span></span>
        {!account.isOperator && !asking && <button type="button" onClick={() => setAsking(true)} className="shrink-0 text-sm text-danger">계정 지우기</button>}
      </div>
      {asking && (
        <form action={formAction} className="flex items-center justify-between gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm">
          <span>계정과 휴대폰 연결을 지워요. 다시 쓰려면 초대를 다시 받고 연결 코드를 새로 붙여넣어야 해요.</span>
          <span className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setAsking(false)} className="text-muted">취소</button>
            <button disabled={pending} className="font-semibold text-danger disabled:opacity-40">정말 지우기</button>
          </span>
        </form>
      )}
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </li>
  );
}
