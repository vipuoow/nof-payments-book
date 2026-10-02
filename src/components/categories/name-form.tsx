"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/tx-actions";

export function NameForm({
  action, label, defaultName = "", button,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  defaultName?: string;
  button: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form key={JSON.stringify(state?.values ?? null)} action={formAction} className="flex flex-1 flex-col">
      <div className="flex gap-2">
        <input
          name="name"
          aria-label={label}
          defaultValue={state?.values?.name ?? defaultName}
          className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-base"
        />
        <button disabled={pending} className="shrink-0 text-accent disabled:opacity-50">{button}</button>
      </div>
      {state?.error && <p role="alert" className="mt-1 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
