"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { setOnnuriPaid, updateTxField } from "@/app/tx-actions";
import { kstLocalValue } from "@/ledger/month";
import { formatWon } from "@/ledger/summary";
import type { TxPatch } from "@/ledger/tx-edit";
import { splitLocal } from "@/ledger/when";
import type { LedgerChoices, RowTx } from "./home-types";
import { checkField, LABEL, Question, whenDay, type Choices, type Draft, type FieldKey } from "./questions";

const draftOf = (t: RowTx): Draft => {
  const { date, time } = splitLocal(kstLocalValue(new Date(t.occurredAt)));
  return { amount: String(Math.abs(t.amount)), merchant: t.merchant, categoryId: t.categoryId, date, time, userId: t.userId };
};

const patchOf = (k: FieldKey, d: Draft): TxPatch =>
  k === "amount" ? { amount: d.amount }
    : k === "merchant" ? { merchant: d.merchant }
      : k === "category" ? { categoryId: d.categoryId ?? null }
        : k === "when" ? { occurredAt: `${d.date}T${d.time}` }
          : { userId: d.userId };

/**
 * 거래 상세(한눈에 보기). 카드 문자 거래는 분류만, 직접 추가한 거래는 모든 항목을 고친다.
 * 항목을 누르면 그 항목 한 화면이 오른쪽에서 밀려 들어오고, 확인하면 돌아와 바뀐 값이 반짝인다.
 */
export function TxDetail({
  tx, choices, now, onClose, onToast,
}: { tx: RowTx; choices: LedgerChoices; now: Date; onClose: () => void; onToast: (t: string) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<FieldKey | null>(null);
  const [stepIn, setStepIn] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(tx));
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState<FieldKey | null>(null);
  const [pending, startTransition] = useTransition();
  const saved = useRef<FieldKey | null>(null);
  // 누르면 바로 체크가 바뀌고, 저장에 실패하면 원래대로 돌아간다
  const [onnuri, setOnnuri] = useOptimistic(tx.paidWith === "onnuri");

  const editable = (k: FieldKey) => tx.kind === "manual" || k === "category";
  const qChoices: Choices = { categories: choices.categories, members: choices.members, now };
  const category = tx.categoryId ? choices.categoryNames[tx.categoryId] : undefined;
  const view = draftOf(tx);
  const value: Record<FieldKey, string> = {
    amount: `${formatWon(tx.amount)}원`,
    merchant: tx.merchant,
    category: category ?? "미지정",
    when: `${whenDay(view.date, now)} ${view.time}`,
    who: choices.members.find((m) => m.userId === tx.userId)?.name ?? "",
  };

  function openStep(k: FieldKey) {
    setDraft(draftOf(tx));
    setError(null);
    setStep(k);
    requestAnimationFrame(() => requestAnimationFrame(() => setStepIn(true)));
  }
  function closeStep(after?: () => void) {
    setStepIn(false);
    window.setTimeout(() => {
      setStep(null);
      after?.();
    }, 400);
  }
  function confirm() {
    if (!step || pending) return;
    const problem = checkField(step, draft);
    if (problem) return setError(problem);
    const k = step;
    startTransition(async () => {
      const r = await updateTxField(tx.id, patchOf(k, draft));
      if (!r.ok) return setError(r.error);
      saved.current = k;
      router.refresh();
    });
  }
  // 저장하고 새 값을 받은 뒤 돌아가서 반짝인다
  useEffect(() => {
    if (pending || !saved.current) return;
    const k = saved.current;
    saved.current = null;
    closeStep(() => {
      setChanged(null);
      requestAnimationFrame(() => setChanged(k));
    });
  }, [pending]);

  function toggleOnnuri(on: boolean) {
    startTransition(async () => {
      setOnnuri(on);
      const r = await setOnnuriPaid(tx.id, on);
      if (!r.ok) return onToast(r.error);
      router.refresh();
    });
  }

  return (
    <>
      <div className="lx-bar lx-fade">
        <button type="button" onClick={onClose}>✕ 닫기</button>
      </div>
      {/* 작은 화면에서는 이 부분만 스크롤된다 */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <div className="lx-fade flex flex-col items-center gap-2 px-5 pb-5 pt-2 text-center">
        <span aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-xl font-extrabold text-accent">
          {category ? category.slice(0, 1) : "?"}
        </span>
        <h2 className="text-[17px] font-semibold">{tx.merchant}</h2>
        <p className="tabular text-[32px] font-extrabold tracking-tight">{formatWon(tx.amount)}원</p>
      </div>
      <div className="lx-fade mx-3.5 rounded-[20px] bg-surface py-1">
        {(Object.keys(LABEL) as FieldKey[]).map((k) => (
          <button
            key={k} type="button" disabled={!editable(k)} onClick={() => openStep(k)}
            className={`lx-field ${changed === k ? "lx-changed" : ""}`}
          >
            <span>{LABEL[k]}</span>
            <b>{value[k]}{editable(k) && <i aria-hidden className="ml-1.5 not-italic text-muted">›</i>}</b>
          </button>
        ))}
        <div className="lx-field">
          <span>카드</span>
          <b data-testid="detail-card" className="!font-medium !text-muted">{tx.card}</b>
        </div>
      </div>
      {tx.kind !== "cancel" && (
        <label className="lx-fade mx-3.5 mt-3 flex items-center justify-between gap-3 rounded-[20px] bg-surface px-[18px] py-3.5">
          <span>
            온누리상품권으로 결제
            <span className="block text-xs text-muted">카드값은 안 나가요. 쓴 돈에는 그대로 들어가요.</span>
          </span>
          <input
            type="checkbox" checked={onnuri} disabled={pending}
            onChange={(e) => toggleOnnuri(e.target.checked)} className="h-6 w-6 shrink-0 accent-accent"
          />
        </label>
      )}
      {tx.kind !== "manual" && (
        <p className="lx-fade mt-3 px-5 text-center text-xs text-muted">카드 문자로 들어온 거래는 분류만 고칠 수 있어요.</p>
      )}
      </div>

      {step && (
        <section className={`lx-step flex flex-col ${stepIn ? "lx-step-in" : ""}`} aria-label={`${LABEL[step]} 고치기`}>
          <div className="lx-inner">
            <div className="lx-bar">
              <button type="button" aria-label="뒤로" className="!text-[22px]" onClick={() => closeStep()}>‹</button>
              <span>{LABEL[step]} 고치기</span>
              <span className="w-8" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col justify-center">
              <Question k={step} draft={draft} onChange={setDraft} onSubmit={confirm} choices={qChoices} error={error} />
            </div>
            <div className="lx-cta">
              <button type="button" className="lx-btn" disabled={pending} onClick={confirm}>확인</button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
