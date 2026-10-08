"use client";

import { useState } from "react";
import { CheckMark, checkThen } from "./check-button";

type Pick = "paste" | "direct";

/**
 * 새로 추가 맨 앞: 카드 문자 붙여넣기 / 직접 적기(좌우로 나란히).
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
    <div className="lx-q">
      <h2>어떻게 적을까요?</h2>
      <div className="mt-2 grid w-full grid-cols-2 gap-2.5">
        {card("paste", "카드 문자 붙여넣기", "받은 결제 문자를 붙여 넣으면 알아서 채워요",
          <svg viewBox="0 0 24 24"><rect x="6" y="4" width="12" height="16" rx="2.5" /><path d="M9.5 4.5V3.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8v.7M9 10h6M9 13.5h6M9 17h3.5" /></svg>)}
        {card("direct", "직접 적기", "금액부터 하나씩 적어요",
          <svg viewBox="0 0 24 24"><path d="M5 19l1-4L15.5 5.5a2.1 2.1 0 013 3L9 18l-4 1zM13.5 7.5l3 3" /></svg>)}
      </div>
    </div>
  );
}
