"use client";

import { useActionState } from "react";
import { saveLimitAction, type LimitState } from "@/app/limit/actions";
import { formatWon } from "@/ledger/summary";

/** 한도 바꾸기 양식: 새 한도 + 이번 달부터/다음 달부터 */
export function LimitForm({ thisLabel, nextLabel, current }: { thisLabel: string; nextLabel: string; current: number | null }) {
  const [state, formAction, pending] = useActionState<LimitState, FormData>(saveLimitAction, null);
  const now = current === null ? "없음" : `${formatWon(current)}원`;
  return (
    <form key={state?.value ?? ""} action={formAction} className="flex flex-1 flex-col">
      <div className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          새 한도
          <input name="amount" inputMode="numeric" required defaultValue={state?.value ?? ""} placeholder="3,000,000"
            className="tabular border-b-2 border-accent bg-transparent py-3 text-2xl font-bold text-foreground outline-none" />
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="when" value="this" defaultChecked className="mt-1 h-5 w-5 accent-accent" />
          <span><b>이번 달부터</b><span className="block text-sm text-muted">{thisLabel}부터 새 한도</span></span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="when" value="next" className="mt-1 h-5 w-5 accent-accent" />
          <span><b>다음 달부터</b><span className="block text-sm text-muted">{thisLabel}은 {now} 그대로, {nextLabel}부터 새 한도</span></span>
        </label>
      </div>
      <p className="mt-3 text-center text-sm text-muted">지난 달 한도는 바뀌지 않아요.</p>
      {state?.error && <p role="alert" className="mt-2 text-center text-sm text-danger">{state.error}</p>}
      <div className="flex-1" />
      <button disabled={pending} className="mt-6 rounded-2xl bg-accent py-4 font-semibold text-white disabled:opacity-50">저장하기</button>
    </form>
  );
}
