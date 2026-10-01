"use client";

import { useActionState, type ReactNode } from "react";

export type SecretState = { value?: string; error?: string } | null;

export function OneTimeSecretForm({
  action,
  buttonLabel,
  valueLabel,
  children,
}: {
  action: (prev: SecretState, formData: FormData) => Promise<SecretState>;
  buttonLabel: string;
  valueLabel: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {children}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">
        {buttonLabel}
      </button>
      {state?.error && <p className="text-red-600">{state.error}</p>}
      {state?.value && (
        <div className="rounded border border-amber-400 bg-amber-50 p-2">
          <p className="mb-1 text-sm">{valueLabel} — 이 화면을 벗어나면 다시 볼 수 없습니다.</p>
          <input
            readOnly
            value={state.value}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded border p-2 font-mono text-xs"
          />
        </div>
      )}
    </form>
  );
}
