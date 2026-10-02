"use client";

import { useActionState } from "react";
import { updateTxAction } from "@/app/tx-actions";

export function TxEditForm({
  txId, returnTo, amount, merchant, occurredAt, userId, memo, members,
}: {
  txId: string; returnTo: string; amount: number; merchant: string; occurredAt: string;
  userId: string; memo: string; members: { userId: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateTxAction, null);
  const field = "w-full rounded-lg bg-surface px-3 py-2 text-base"; // 16px 미만이면 아이폰이 확대한다
  const v = state?.values;
  return (
    // React는 액션 뒤 폼을 초기화하지만 <select>는 바뀐 defaultValue를 다시 읽지 않는다.
    // 실패해 입력값이 돌아오면 폼을 새로 만들어 select까지 그 값으로 채운다.
    <form key={JSON.stringify(v ?? null)} action={formAction} className="mt-3 flex flex-col gap-3 text-sm">
      <input type="hidden" name="txId" value={txId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>금액<input name="amount" inputMode="numeric" defaultValue={v?.amount ?? Math.abs(amount)} className={field} /></label>
      <label>가맹점<input name="merchant" defaultValue={v?.merchant ?? merchant} className={field} /></label>
      <label>일시<input name="occurredAt" type="datetime-local" defaultValue={v?.occurredAt ?? occurredAt} className={field} /></label>
      <label>사람
        <select name="userId" defaultValue={v?.userId ?? userId} className={field}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </label>
      <label>메모<input name="memo" defaultValue={v?.memo ?? memo} className={field} /></label>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-accent py-3 text-white disabled:opacity-50">저장</button>
    </form>
  );
}
