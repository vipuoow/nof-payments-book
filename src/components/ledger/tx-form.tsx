"use client";

import { useActionState } from "react";
import { createTxAction } from "@/app/tx-actions";

export function TxForm({
  members, choices, defaultUserId, defaultOccurredAt, rawId,
}: {
  members: { userId: string; name: string }[];
  choices: { id: string; name: string }[];
  defaultUserId: string;
  defaultOccurredAt: string;
  rawId: string | null;
}) {
  const [state, formAction, pending] = useActionState(createTxAction, null);
  const field = "w-full rounded-lg bg-surface px-3 py-2";
  const v = state?.values;
  return (
    // React는 액션 뒤 폼을 초기화하지만 <select>는 바뀐 defaultValue를 다시 읽지 않는다.
    // 실패해 입력값이 돌아오면 폼을 새로 만들어 select까지 그 값으로 채운다.
    <form key={JSON.stringify(v ?? null)} action={formAction} className="flex flex-col gap-3">
      {rawId && <input type="hidden" name="rawId" value={rawId} />}
      <label>금액<input name="amount" inputMode="numeric" autoFocus defaultValue={v?.amount ?? ""} className={field} /></label>
      <label>가맹점<input name="merchant" defaultValue={v?.merchant ?? ""} className={field} /></label>
      <label>일시<input name="occurredAt" type="datetime-local" defaultValue={v?.occurredAt ?? defaultOccurredAt} className={field} /></label>
      <label>사람
        <select name="userId" defaultValue={v?.userId ?? defaultUserId} className={field}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </label>
      <label>카테고리
        <select name="categoryId" defaultValue={v?.categoryId ?? ""} className={field}>
          <option value="">미지정</option>
          {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>메모<input name="memo" defaultValue={v?.memo ?? ""} className={field} /></label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-accent py-3 text-white disabled:opacity-50">저장</button>
    </form>
  );
}
