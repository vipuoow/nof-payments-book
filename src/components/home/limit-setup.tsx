"use client";

import { useActionState, useState } from "react";
import { saveLimitAction, type LimitState } from "@/app/limit/actions";
import { formatWon } from "@/ledger/summary";

const QUICK = [1_500_000, 2_000_000, 2_500_000, 3_000_000];

/** 처음 홈 2단계: 이번 달 전체 한도 정하기(건너뛸 수 없다) */
export function LimitSetup({ connectedName }: { connectedName: string | null }) {
  const [state, formAction, pending] = useActionState<LimitState, FormData>(saveLimitAction, null);
  const [value, setValue] = useState(state?.value ?? "");
  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="when" value="this" />
      <input type="hidden" name="first" value="1" />
      <section className="flex flex-1 flex-col gap-3 pt-8">
        <p className="text-sm font-semibold text-ok">✓ {connectedName ? `${connectedName}님 휴대폰이` : "휴대폰이"} 연결됐어요</p>
        <h1 className="text-2xl font-bold leading-snug">이번 달은 얼마까지<br />쓸까요?</h1>
        <p className="text-muted">두 사람이 함께 쓰는 한 달 한도예요. 한도를 정해야 시작할 수 있어요.</p>
        <label className="mt-4 flex flex-col gap-1 text-sm text-muted">
          한 달 한도
          <input
            name="amount"
            inputMode="numeric"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="2,500,000"
            className="tabular border-b-2 border-accent bg-transparent py-3 text-2xl font-bold text-foreground outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((n) => (
            <button key={n} type="button" onClick={() => setValue(formatWon(n))}
              className={`rounded-full border px-4 py-2 text-sm ${value === formatWon(n) ? "border-transparent bg-accent-soft font-semibold text-accent" : "border-line bg-surface"}`}>
              {n / 10_000}만
            </button>
          ))}
        </div>
        {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      </section>
      <button disabled={pending} className="mt-6 rounded-2xl bg-accent py-4 font-semibold text-white disabled:opacity-50">이 한도로 시작하기</button>
      <p className="mt-2 text-center text-xs text-muted">한도는 메뉴의 “한도”에서 언제든 바꿀 수 있어요.</p>
    </form>
  );
}
