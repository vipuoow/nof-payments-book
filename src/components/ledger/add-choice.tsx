"use client";

import { useState } from "react";
import { CheckMark, checkThen } from "./check-button";

type Pick = "paste" | "direct";

/**
 * 새로 추가 맨 앞: 결제문자 붙여넣기 / 직접 입력(좌우로 나란히).
 * 고르면 그 카드가 ✓로 바뀌며 빛이 은은하게 퍼진 뒤 넘어간다(입력 끝내기와 같은 움직임).
 */
export function AddChoice({ onPaste, onDirect }: { onPaste: () => void; onDirect: () => void }) {
  const [picked, setPicked] = useState<Pick | null>(null);

  function pick(k: Pick, el: HTMLElement) {
    if (picked) return;
    setPicked(k);
    checkThen(el, k === "paste" ? onPaste : onDirect);
  }
  const card = (k: Pick, title: string, desc: string, icon: React.ReactNode) => (
    <button
      type="button" aria-busy={picked === k || undefined} disabled={picked !== null && picked !== k}
      onClick={(e) => pick(k, e.currentTarget)}
      className={`add-choice ${picked === k ? "is-checked" : ""} ${picked && picked !== k ? "is-dim" : ""}`}
    >
      <span className="add-choice-icon" aria-hidden>{icon}</span>
      <b>{title}</b>
      <span className="add-choice-desc">{desc}</span>
      <span className="add-choice-check" aria-hidden><CheckMark /></span>
    </button>
  );

  return (
    <div className="lx-q add-choose">
      <h2>어떻게 적을까요?</h2>
      <div className="grid w-full grid-cols-2 gap-3">
        {card("paste", "결제문자 붙여넣기", "받은 결제 문자를 붙여 넣으면 알아서 채워요", <PasteIcon />)}
        {card("direct", "직접 입력", "금액부터 하나씩 적어요", <WriteIcon />)}
      </div>
    </div>
  );
}

/* 두 가지 색(옅은 면 + 선)의 아이콘. 선은 강조색, 면은 강조색을 아주 옅게 */
function PasteIcon() {
  return (
    <svg viewBox="0 0 32 32">
      <path className="ic-fill" d="M7 8.5A3.5 3.5 0 0 1 10.5 5h11A3.5 3.5 0 0 1 25 8.5v8a3.5 3.5 0 0 1-3.5 3.5H15l-5 4v-4h0A3.5 3.5 0 0 1 7 16.5z" />
      <path d="M7 8.5A3.5 3.5 0 0 1 10.5 5h11A3.5 3.5 0 0 1 25 8.5v8a3.5 3.5 0 0 1-3.5 3.5H15l-5 4v-4h0A3.5 3.5 0 0 1 7 16.5z" />
      <path d="M11.5 10.5h9M11.5 14.5h5.5" />
      <path className="ic-spark" d="M26.5 21.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </svg>
  );
}
function WriteIcon() {
  return (
    <svg viewBox="0 0 32 32">
      <path className="ic-fill" d="M20.6 5.9a2.6 2.6 0 0 1 3.7 3.7L12.6 21.3 7.5 23l1.7-5.1z" />
      <path d="M20.6 5.9a2.6 2.6 0 0 1 3.7 3.7L12.6 21.3 7.5 23l1.7-5.1z" />
      <path d="M18.6 7.9l3.7 3.7" />
      <path d="M7 27h18" className="ic-soft" />
    </svg>
  );
}
