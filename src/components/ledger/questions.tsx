"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { dayLabel } from "@/ledger/month";
import type { Member } from "@/ledger/summary";
import { dayShortcuts } from "@/ledger/when";
import { koWon, nextRawAmount, rawFromEdit } from "@/ledger/won";

/** 한 화면에 하나씩 묻는 항목. 새로 추가는 이 순서로 묻는다 */
export const STEPS = ["amount", "merchant", "category", "when", "who"] as const;
export type FieldKey = (typeof STEPS)[number];
export const LABEL: Record<FieldKey, string> = { amount: "금액", merchant: "어디서", category: "분류", when: "언제", who: "누가" };
const TITLE: Record<FieldKey, string> = {
  amount: "얼마 썼어요?", merchant: "어디서 썼어요?", category: "어떤 분류예요?", when: "언제 썼어요?", who: "누가 썼어요?",
};

/** amount는 실제 숫자(쉼표 없음), categoryId는 undefined면 아직 안 고름(null은 미지정) */
export type Draft = { amount: string; merchant: string; categoryId: string | null | undefined; date: string; time: string; userId: string };
export type Choices = { categories: { id: string; name: string }[]; members: Member[]; now: Date };

/** 확인 전에 화면에서 먼저 막는다(서버가 다시 검사한다) */
export function checkField(k: FieldKey, d: Draft): string | null {
  if (k === "amount") return Number(d.amount) >= 1 ? null : "금액을 입력해 주세요.";
  if (k === "merchant") return d.merchant.trim() ? (d.merchant.trim().length > 100 ? "가맹점은 100자까지 입력할 수 있습니다." : null) : "어디서 썼는지 입력해 주세요.";
  if (k === "category") return d.categoryId === undefined ? "분류를 골라 주세요." : null;
  if (k === "when") return d.date && /^\d{2}:\d{2}$/.test(d.time) ? null : "날짜와 시각을 골라 주세요.";
  return d.userId ? null : "누가 썼는지 골라 주세요.";
}

/** 쌓인 값: 금액은 한글 단위 */
export function displayField(k: FieldKey, d: Draft, c: Choices): string {
  if (k === "amount") return `${koWon(d.amount)}원`;
  if (k === "merchant") return d.merchant.trim();
  if (k === "category") return d.categoryId ? (c.categories.find((x) => x.id === d.categoryId)?.name ?? "미지정") : "미지정";
  if (k === "when") return `${whenDay(d.date, c.now)} ${d.time}`;
  return c.members.find((m) => m.userId === d.userId)?.name ?? "";
}

/** "오늘"·"어제"·"그저께", 그 밖은 "10월 3일 (금)" */
export function whenDay(date: string, now: Date): string {
  return dayShortcuts(now).find((s) => s.date === date)?.label ?? dayLabel(date);
}

export function Question({
  k, draft, onChange, onSubmit, choices, error,
}: {
  k: FieldKey; draft: Draft; onChange: (d: Draft) => void; onSubmit: () => void; choices: Choices; error: string | null;
}) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <div className="lx-q" key={k}>
      <h2 id={`lx-q-${k}`}>{TITLE[k]}</h2>
      {k === "amount" && (
        <label className="lx-money">
          <AmountInput raw={draft.amount} onRaw={(amount) => set({ amount })} onKeyDown={enter} />
          <span>원</span>
        </label>
      )}
      {k === "merchant" && (
        <input
          aria-labelledby="lx-q-merchant" autoFocus value={draft.merchant} maxLength={100} enterKeyHint="done"
          onChange={(e) => set({ merchant: e.target.value })} onKeyDown={enter} placeholder="가게 이름"
        />
      )}
      {k === "category" && (
        <div className="lx-chips" role="group" aria-labelledby="lx-q-category">
          {choices.categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={draft.categoryId === c.id} onClick={() => set({ categoryId: c.id })}>{c.name}</button>
          ))}
          <button type="button" aria-pressed={draft.categoryId === null} onClick={() => set({ categoryId: null })}>미지정</button>
        </div>
      )}
      {k === "when" && <WhenInput draft={draft} set={set} now={choices.now} />}
      {k === "who" && (
        <div className={`lx-chips ${choices.members.length <= 2 ? "lx-two" : ""}`} role="group" aria-labelledby="lx-q-who">
          {choices.members.map((m) => (
            <button key={m.userId} type="button" aria-pressed={draft.userId === m.userId} onClick={() => set({ userId: m.userId })}>{m.name}</button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function WhenInput({ draft, set, now }: { draft: Draft; set: (p: Partial<Draft>) => void; now: Date }) {
  const shortcuts = dayShortcuts(now);
  return (
    <>
      <div className="lx-chips" role="group" aria-labelledby="lx-q-when">
        {shortcuts.map((s) => (
          <button key={s.label} type="button" aria-pressed={draft.date === s.date} onClick={() => set({ date: s.date })}>{s.label}</button>
        ))}
      </div>
      <div className="flex gap-3">
        <input aria-label="날짜" type="date" className="lx-small" value={draft.date} max={shortcuts[0].date} onChange={(e) => set({ date: e.target.value })} />
        <input aria-label="시각" type="time" className="lx-small" value={draft.time} onChange={(e) => set({ time: e.target.value })} />
      </div>
    </>
  );
}

/**
 * 금액 칸: 입력하는 즉시 한글 단위로 보인다(13325 → 1만 3325). 실제 숫자는 따로 기억한다
 * (화면 글자에서 숫자만 뽑으면 "10만" 뒤에 5를 눌렀을 때 105가 되므로).
 */
function AmountInput({ raw, onRaw, onKeyDown }: { raw: string; onRaw: (raw: string) => void; onKeyDown: (e: React.KeyboardEvent) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const rawRef = useRef(raw);
  useLayoutEffect(() => { rawRef.current = raw; }, [raw]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const before = (e: InputEvent) => {
      // 막을 수 없는 입력(일부 안드로이드 키보드·조합 중 글자)은 onChange에서 바뀐 만큼 반영한다
      if (!e.cancelable || e.isComposing || e.inputType.includes("Composition")) return;
      // 글자를 골라 둔 채 누르면(전체 선택 후 입력 등) 처음부터 다시
      const selected = el.selectionStart !== el.selectionEnd;
      const next = nextRawAmount(selected ? "" : rawRef.current, e.inputType, e.data ?? e.dataTransfer?.getData("text") ?? null);
      if (next === null) return;
      e.preventDefault();
      onRaw(next);
    };
    el.addEventListener("beforeinput", before);
    return () => el.removeEventListener("beforeinput", before);
  }, [onRaw]);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el) el.setSelectionRange(el.value.length, el.value.length);
  }, [raw]);
  return (
    <input
      ref={ref} aria-label="금액" autoFocus inputMode="numeric" enterKeyHint="next" autoComplete="off"
      value={koWon(raw)} placeholder="0" onKeyDown={onKeyDown}
      // beforeinput을 막지 못한 경우: 이전 화면 글자와 비교해 바뀐 만큼만 반영한다
      onChange={(e) => onRaw(rawFromEdit(rawRef.current, e.target.value))}
    />
  );
}
