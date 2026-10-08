"use client";

import { useActionState, useRef } from "react";
import { setOnnuriAction } from "@/app/tx-actions";

/** 거래 창: "온누리상품권으로 결제" 체크. 누르면 바로 저장하고 창을 닫는다 */
export function OnnuriToggle({ txId, on, returnTo }: { txId: string; on: boolean; returnTo: string }) {
  const [state, formAction, pending] = useActionState(setOnnuriAction, null);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={formAction} className="mt-4">
      <input type="hidden" name="txId" value={txId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3">
        <span>
          온누리상품권으로 결제
          <span className="block text-xs text-muted">카드값은 안 나가요. 쓴 돈에는 그대로 들어가요.</span>
        </span>
        <input
          type="checkbox"
          name="onnuri"
          defaultChecked={on}
          disabled={pending}
          onChange={() => form.current?.requestSubmit()}
          className="h-6 w-6 shrink-0 accent-accent"
        />
      </label>
      {state?.error && <p role="alert" className="mt-1 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
