"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/tx-actions";

/** 버튼 하나짜리 서버 액션 폼. 실패하면 이유를 버튼 아래에 보여 준다. */
export function ActionButton({
  action, label, confirmText, className = "",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button disabled={pending} className={`disabled:opacity-50 ${className}`}>{label}</button>
      {state?.error && <p role="alert" className="mt-1 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
