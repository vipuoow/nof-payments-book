"use client";

import { CheckButton, OFFLINE, type CheckButtonHandle } from "./check-button";
import { CloseX } from "@/components/icons";
import { useLayoutEffect, useRef, useState } from "react";
import { createTx } from "@/app/tx-actions";
import { kstLocalValue, kstTime } from "@/ledger/month";
import { formatWon } from "@/ledger/summary";
import type { Overlap } from "@/ledger/tx-edit";
import { splitLocal } from "@/ledger/when";
import type { LedgerChoices, RawView } from "./home-types";
import { AddChoice } from "./add-choice";
import { flyFrom } from "./motion";
import { PasteStep, type PasteFill } from "./paste-step";
import { checkField, displayField, LABEL, Question, STEPS, whenDay, type Choices, type Draft, type FieldKey } from "./questions";

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

/** 붙여 넣은 문자에서 찾은 값: 누가 = 나, 분류는 규칙이 있을 때만. 찾은 항목은 쌓아 두고 빠진 것만 묻는다 */
function fromPaste(meId: string, now: Date, f: PasteFill): { draft: Draft; done: FieldKey[] } {
  const at = splitLocal(kstLocalValue(f.occurredAt ?? now));
  const draft: Draft = { amount: String(f.amount), merchant: f.merchant ?? "", categoryId: f.categoryId, date: at.date, time: at.time, userId: meId };
  const done: FieldKey[] = ["amount", "who"];
  if (f.merchant) done.push("merchant");
  if (f.categoryId !== undefined) done.push("category");
  if (f.occurredAt) done.push("when");
  return { draft, done };
}

/**
 * 새로 추가: 맨 앞에서 결제문자 붙여넣기 / 직접 입력를 고른다(확인할 문자에서 왔으면 바로 입력).
 * 질문은 화면 가운데에 하나씩(금액 → 어디서 → 분류 → 언제 → 누가).
 * 답하면 그 값이 위로 올라가 쌓이고, 쌓인 값을 누르면 다시 고친다. 다 쌓이면 [저장하기].
 */
export function AddFlow({
  meId, now, choices, raw, rawId, onClose, onSaved,
}: {
  meId: string; now: Date; choices: LedgerChoices; raw: RawView | null;
  /** 문자에서 왔으면 그 문자 id(목록이 새로 고쳐져 raw가 사라져도 서버가 처리 여부를 확인하도록 그대로 보낸다) */
  rawId: string | null;
  onClose: () => void; onSaved: (id: string, month: string) => void;
}) {
  const [start] = useState(() => initial(meId, now, raw));
  const [draft, setDraft] = useState<Draft>(start.draft);
  const [done, setDone] = useState<FieldKey[]>(start.done);
  const [redo, setRedo] = useState<FieldKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 저장한 뒤 새 줄로 들어가기 전까지 다시 누를 수 없다(두 번 저장 방지)
  const [saved, setSaved] = useState(false);
  const [mode, setModeNow] = useState<"choose" | "paste" | "form">(raw ? "form" : "choose");
  // 화면을 바꿀 때 앞으로는 오른쪽에서, 뒤로는 왼쪽에서 밀려 들어온다(처음 화면은 그대로)
  const [swap, setSwap] = useState<"" | "fwd" | "back">("");
  const setMode = (m: "choose" | "paste" | "form") => {
    setSwap(m === "choose" ? "back" : "fwd");
    setModeNow(m);
  };
  const [pasted, setPasted] = useState(false);
  const [overlap, setOverlap] = useState<Overlap | null>(null);
  const fly = useRef<{ k: FieldKey; from: DOMRect | null } | null>(null);
  const firstStack = useRef(true);
  const center = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const cta = useRef<CheckButtonHandle>(null);

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
  }, [done, redo, mode]);

  /** 지금 질문의 답 검사: 통과해야 버튼이 체크된다 */
  function checkCurrent() {
    if (!current) return false;
    const problem = checkField(current, draft);
    setError(problem);
    return !problem;
  }
  /** 답을 위로 쌓고 다음 질문으로 */
  function advance() {
    if (!current) return;
    const q = center.current?.querySelector("input, .lx-chips, h2");
    fly.current = { k: current, from: q?.getBoundingClientRect() ?? null };
    setDone((d) => (d.includes(current) ? [...d] : [...d, current]));
    setRedo(null);
  }


  function checkAll() {
    if (saved) return false;
    const missing = STEPS.find((s) => checkField(s, draft));
    if (!missing) return true;
    setRedo(missing);
    setError(checkField(missing, draft));
    return false;
  }
  function startPaste(f: PasteFill) {
    const p = fromPaste(meId, now, f);
    firstStack.current = true; // 찾은 값이 차례로 떠오른다
    setDraft(p.draft);
    setDone(p.done);
    setPasted(true);
    setMode("form");
  }
  /** force: 겹침 경고 뒤 [그래도 저장] */
  async function save(force = false) {
    // 저장한 뒤 그 달로 옮겨 가는 동안 다시 눌러도 또 저장하지 않는다(그래도 저장 버튼 포함)
    if (saved) return false;
    const r = await createTx({
      amount: draft.amount, merchant: draft.merchant.trim(), occurredAt: `${draft.date}T${draft.time}`,
      userId: draft.userId, categoryId: draft.categoryId ?? null, rawId, checkOverlap: pasted && !force,
    }).catch(() => ({ ok: false as const, error: OFFLINE }));
    if (!r.ok) {
      if ("overlap" in r && r.overlap) {
        setOverlap(r.overlap);
        setError(null);
      } else setError(r.error);
      return false;
    }
    setSaved(true);
    onSaved(r.id, r.month);
    return true;
  }

  const swapClass = swap ? `lx-swap lx-swap-${swap}` : "";
  if (mode === "paste") {
    return (
      <div key="paste" className={`flex min-h-0 flex-1 flex-col ${swapClass}`}>
        <PasteStep now={now} onBack={() => setMode("choose")} onRead={startPaste} onDirect={() => setMode("form")} />
      </div>
    );
  }
  const closeBar = (
    <div className="lx-bar lx-fade">
      <button type="button" onClick={onClose} aria-label="닫기" className="close-icon"><CloseX /></button>
      {mode === "form" && (
        <span className="lx-dots" aria-hidden>
          {STEPS.map((s) => <i key={s} className={s === current && !redo ? "lx-on" : done.includes(s) ? "lx-done" : ""} />)}
        </span>
      )}
      <span className="w-14" />
    </div>
  );
  if (mode === "choose") {
    return (
      <div key="choose" className={`flex min-h-0 flex-1 flex-col ${swapClass}`}>
        {closeBar}
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <AddChoice onPaste={() => setMode("paste")} onDirect={() => setMode("form")} />
        </div>
      </div>
    );
  }
  const seen = overlap ? new Date(overlap.occurredAt) : null;

  return (
    <div key="form" className={`flex min-h-0 flex-1 flex-col ${swapClass}`}>
      {closeBar}
      {(raw || pasted) && <p className="lx-fade mx-[18px] mb-1 text-xs text-accent">문자에서 찾은 내용을 미리 채웠어요. 틀리면 눌러서 고쳐 주세요.</p>}
      <div ref={stack} className="lx-fade flex flex-col gap-1.5 px-4 pt-1.5" aria-label="입력한 내용">
        {STEPS.filter((s) => done.includes(s)).map((s) => (
          <button key={s} type="button" data-stack={s} className="lx-si" onClick={() => { setError(null); setOverlap(null); setRedo(s); }}>
            <span>{LABEL[s]}</span><b>{displayField(s, draft, qChoices)}</b>
          </button>
        ))}
      </div>
      <div ref={center} className="flex min-h-0 flex-1 flex-col justify-center">
        {current ? (
          <Question key={current} k={current} draft={draft} onChange={setDraft} onSubmit={() => cta.current?.press()} choices={qChoices} error={error} />
        ) : (
          <div className="lx-q">
            <h2>다 입력했어요</h2>
            <p className="text-sm text-muted">맞으면 저장해 주세요. 위 항목을 누르면 고칠 수 있어요.</p>
            {overlap && seen && (
              <div role="alert" className="overlap-warn lx-msg">
                <b>이미 들어온 결제 같아요</b>
                <span>{overlap.merchant} · {whenDay(splitLocal(kstLocalValue(seen)).date, now)} {kstTime(seen)} · {formatWon(overlap.amount)}원</span>
                <button type="button" onClick={onClose} className="text-sm text-muted">닫기</button>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </div>
      <div className="lx-cta">
        {current ? (
          <CheckButton key="step" ref={cta} label={redo ? "고쳤어요" : left === 0 ? "다 입력했어요" : "다음"} validate={checkCurrent} run={advance} />
        ) : overlap ? (
          <CheckButton key="force" label="그래도 저장" run={() => save(true)} keep />
        ) : (
          <CheckButton key="save" label="저장하기" validate={checkAll} run={() => save()} keep />
        )}
      </div>
    </div>
  );
}
