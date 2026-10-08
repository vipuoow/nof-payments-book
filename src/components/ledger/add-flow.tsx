"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { createTx } from "@/app/tx-actions";
import { kstLocalValue } from "@/ledger/month";
import { splitLocal } from "@/ledger/when";
import type { LedgerChoices, RawView } from "./home-types";
import { flyFrom } from "./motion";
import { checkField, displayField, LABEL, Question, STEPS, type Choices, type Draft, type FieldKey } from "./questions";

function initial(meId: string, now: Date, raw: RawView | null): { draft: Draft; done: FieldKey[] } {
  const at = splitLocal(raw?.guess.occurredAt ?? kstLocalValue(now));
  const draft: Draft = { amount: "", merchant: "", categoryId: undefined, date: at.date, time: at.time, userId: raw?.userId ?? meId };
  if (!raw) return { draft, done: [] };
  // 문자에서 찾은 값과 문자를 받은 사람은 미리 쌓아 두고, 빠진 항목만 묻는다
  const done: FieldKey[] = ["who"];
  if (raw.guess.amount) { draft.amount = String(raw.guess.amount); done.push("amount"); }
  if (raw.guess.merchant) { draft.merchant = raw.guess.merchant; done.push("merchant"); }
  if (raw.guess.occurredAt) done.push("when");
  return { draft, done };
}

/**
 * 새로 추가: 질문은 화면 가운데에 하나씩(금액 → 어디서 → 분류 → 언제 → 누가).
 * 답하면 그 값이 위로 올라가 쌓이고, 쌓인 값을 누르면 다시 고친다. 다 쌓이면 [저장하기].
 */
export function AddFlow({
  meId, now, choices, raw, onClose, onSaved,
}: {
  meId: string; now: Date; choices: LedgerChoices; raw: RawView | null;
  onClose: () => void; onSaved: (id: string, month: string) => void;
}) {
  const [start] = useState(() => initial(meId, now, raw));
  const [draft, setDraft] = useState<Draft>(start.draft);
  const [done, setDone] = useState<FieldKey[]>(start.done);
  const [redo, setRedo] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 저장한 뒤 새 줄로 들어가기 전까지 다시 누를 수 없다(두 번 저장 방지)
  const [saved, setSaved] = useState(false);
  const fly = useRef<{ k: FieldKey; from: DOMRect | null } | null>(null);
  const firstStack = useRef(true);
  const center = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);

  const current = redo ?? STEPS.find((s) => !done.includes(s)) ?? null;
  const left = STEPS.filter((s) => !done.includes(s) && s !== current).length;
  const qChoices: Choices = { categories: choices.categories, members: choices.members, now };

  // 쌓인 값이 질문 자리에서 위로 올라간다(처음 미리 채운 값은 차례로 떠오른다)
  useLayoutEffect(() => {
    if (firstStack.current) {
      firstStack.current = false;
      stack.current?.querySelectorAll<HTMLElement>("[data-stack]").forEach((el) => flyFrom(el, null));
      return;
    }
    const f = fly.current;
    fly.current = null;
    if (!f) return;
    const el = stack.current?.querySelector<HTMLElement>(`[data-stack="${f.k}"]`);
    if (el) {
      flyFrom(el, f.from);
      el.classList.remove("lx-pop");
      void el.offsetWidth;
      el.classList.add("lx-pop");
    }
  }, [done, redo]);

  function next() {
    if (!current || pending) return;
    const problem = checkField(current, draft);
    if (problem) return setError(problem);
    setError(null);
    const q = center.current?.querySelector("input, .lx-chips, h2");
    fly.current = { k: current, from: q?.getBoundingClientRect() ?? null };
    setDone((d) => (d.includes(current) ? [...d] : [...d, current]));
    setRedo(null);
  }

  function save() {
    if (pending || saved) return;
    const missing = STEPS.find((s) => checkField(s, draft));
    if (missing) {
      setRedo(missing);
      return setError(checkField(missing, draft));
    }
    startTransition(async () => {
      const r = await createTx({
        amount: draft.amount, merchant: draft.merchant.trim(), occurredAt: `${draft.date}T${draft.time}`,
        userId: draft.userId, categoryId: draft.categoryId ?? null, rawId: raw?.id ?? null,
      });
      if (!r.ok) return setError(r.error);
      setSaved(true);
      onSaved(r.id, r.month);
    });
  }

  return (
    <>
      <div className="lx-bar lx-fade">
        <button type="button" onClick={onClose}>✕ 닫기</button>
        <span className="lx-dots" aria-hidden>
          {STEPS.map((s) => <i key={s} className={s === current && !redo ? "lx-on" : done.includes(s) ? "lx-done" : ""} />)}
        </span>
        <span className="w-14" />
      </div>
      {raw && <p className="lx-fade mx-[18px] mb-1 text-xs text-accent">문자에서 찾은 내용을 미리 채웠어요. 틀리면 눌러서 고쳐 주세요.</p>}
      <div ref={stack} className="lx-fade flex flex-col gap-1.5 px-4 pt-1.5" aria-label="입력한 내용">
        {STEPS.filter((s) => done.includes(s)).map((s) => (
          <button key={s} type="button" data-stack={s} className="lx-si" onClick={() => { setError(null); setRedo(s); }}>
            <span>{LABEL[s]}</span><b>{displayField(s, draft, qChoices)}</b>
          </button>
        ))}
      </div>
      <div ref={center} className="flex min-h-0 flex-1 flex-col justify-center">
        {current ? (
          <Question key={current} k={current} draft={draft} onChange={setDraft} onSubmit={next} choices={qChoices} error={error} />
        ) : (
          <div className="lx-q">
            <h2>다 입력했어요</h2>
            <p className="text-sm text-muted">맞으면 저장해 주세요. 위 항목을 누르면 고칠 수 있어요.</p>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>
      <div className="lx-cta">
        {current ? (
          <button type="button" className="lx-btn" onClick={next}>{redo ? "고쳤어요" : left === 0 ? "다 입력했어요" : "다음"}</button>
        ) : (
          <button type="button" className="lx-btn" disabled={pending || saved} onClick={save}>{pending || saved ? "저장하는 중…" : "저장하기"}</button>
        )}
      </div>
    </>
  );
}
