"use client";

import { useActionState } from "react";
import { setCategoryAction } from "@/app/tx-actions";

export function CategoryPicker({
  txId, current, choices, returnTo,
}: { txId: string; current: string | null; choices: { id: string; name: string }[]; returnTo: string }) {
  const [state, formAction, pending] = useActionState(setCategoryAction, null);
  const button = (selected: boolean) =>
    `rounded-xl px-2 py-3 text-sm disabled:opacity-50 ${selected ? "bg-accent text-white" : "bg-surface"}`;
  return (
    <form action={formAction}>
      <input type="hidden" name="txId" value={txId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="grid grid-cols-3 gap-2">
        {choices.map((c) => (
          <button key={c.id} name="categoryId" value={c.id} disabled={pending} aria-pressed={c.id === current} className={button(c.id === current)}>
            {c.name}
          </button>
        ))}
        <button name="categoryId" value="" disabled={pending} aria-pressed={current === null} className={button(current === null)}>
          미지정
        </button>
      </div>
      {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
