"use client";

import { useActionState } from "react";
import { saveBudgetsAction } from "@/app/budget/actions";
import { formatWon } from "@/ledger/summary";

export type BudgetEntry = { key: string; label: string; amount: number | null; spent: number };

export function BudgetForm({ entries }: { entries: BudgetEntry[] }) {
  const [state, formAction, pending] = useActionState(saveBudgetsAction, null);
  const v = state?.values;
  return (
    // 실패하면 입력값으로 폼을 새로 만든다(React 19 폼 초기화 대응)
    <form key={JSON.stringify(v ?? null)} action={formAction} className="flex flex-col">
      <ul className="divide-y divide-line border-y border-line">
        {entries.map((e) => {
          const name = `b:${e.key}`;
          return (
            <li key={e.key} className="flex items-center gap-3 py-3">
              <span className="flex-1">
                {e.label}
                <span className="tabular block text-xs text-muted">이번 달 {formatWon(e.spent)}원 사용</span>
              </span>
              <span className="w-36">
                {/* 화면을 연 때의 값. 저장할 때 이것과 비교해 손댄 칸만 쓴다(다른 사람의 변경을 덮어쓰지 않게). */}
                <input type="hidden" name={`o:${e.key}`} value={e.amount === null ? "" : String(e.amount)} />
                <input
                  name={name}
                  aria-label={`${e.label} 예산`}
                  inputMode="numeric"
                  placeholder="없음"
                  defaultValue={v?.[name] ?? (e.amount === null ? "" : formatWon(e.amount))}
                  className="tabular w-full rounded-lg bg-surface px-3 py-2 text-right text-base"
                />
                {state?.errors?.[name] && <span role="alert" className="mt-1 block text-xs text-danger">{state.errors[name]}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {state?.error && <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="mt-4 rounded-xl bg-accent py-3 text-white disabled:opacity-50">저장</button>
    </form>
  );
}
