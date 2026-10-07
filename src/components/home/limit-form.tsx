"use client";

import { useActionState, useState } from "react";
import { saveLimitAction, type LimitState } from "@/app/limit/actions";
import { formatWon } from "@/ledger/summary";

/** 한도 바꾸기 양식: 새 한도 + 이번 달부터/다음 달부터 */
export function LimitForm({ thisLabel, nextLabel, current }: { thisLabel: string; nextLabel: string; current: number | null }) {
  const [state, formAction, pending] = useActionState<LimitState, FormData>(saveLimitAction, null);
  // 오류가 나도 입력값과 고른 적용 달을 그대로 둔다(양식을 다시 그리면 "이번 달부터"로 돌아가 엉뚱한 달에 저장될 수 있다)
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState<"this" | "next">("this");
  const now = current === null ? "없음" : `${formatWon(current)}원`;
  return (
    <form action={formAction} className="flex flex-1 flex-col">
      {/* 적용 달은 화면 상태에서 보낸다: React가 저장 뒤 양식을 처음 값으로 되돌려도 고른 달이 그대로 간다 */}
      <input type="hidden" name="when" value={when} />
      <div className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-muted">
          새 한도
          <input name="amount" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="3,000,000"
            className="tabular border-b-2 border-accent bg-transparent py-3 text-2xl font-bold text-foreground outline-none" />
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="when-choice" value="this" checked={when === "this"} onChange={() => setWhen("this")} className="mt-1 h-5 w-5 accent-accent" />
          <span><b>이번 달부터</b><span className="block text-sm text-muted">{thisLabel}부터 새 한도</span></span>
        </label>
        <label className="flex items-start gap-3">
          <input type="radio" name="when-choice" value="next" checked={when === "next"} onChange={() => setWhen("next")} className="mt-1 h-5 w-5 accent-accent" />
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
