"use client";

import { useEffect, useRef, useState } from "react";
import { pushOverlay } from "./overlay-history";

const OPEN_MS = 3000;
const CLOSE_MS = 250;

/**
 * 홈 머리의 +(설계 2026-10-08 붙여넣기). 누르면 +가 ×로 돌고 왼쪽에 [결제 직접 입력]이 펼쳐진다.
 * 3초 동안 누르지 않거나, ×·바깥을 누르면 접힌다. 알약을 누르면 새로 추가(주소에 add=1)가 열린다.
 */
export function AddButton({ month }: { month: string }) {
  const href = `/?month=${month}&add=1`;
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const closer = useRef<number | undefined>(undefined);
  const pill = useRef<HTMLAnchorElement>(null);

  function close() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setOpen(false);
    setClosing(true);
    window.clearTimeout(closer.current);
    closer.current = window.setTimeout(() => { setOpen(false); setClosing(false); }, CLOSE_MS);
  }

  // 열려 있는 동안만: 3초 타이머와 바깥 누르기
  useEffect(() => {
    if (!open || closing) return;
    // 키보드·화면 읽기로 알약에 머무는 동안은 접지 않는다(벗어나면 접힌다)
    const timer = window.setTimeout(() => { if (document.activeElement !== pill.current) close(); }, OPEN_MS);
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    return () => { window.clearTimeout(timer); document.removeEventListener("pointerdown", outside); };
  }, [open, closing]);
  useEffect(() => () => window.clearTimeout(closer.current), []);

  return (
    <div ref={box} className={`add-menu ${open && !closing ? "is-open" : ""}`}>
      {open && (
        <a
          ref={pill} href={href} className={`add-pill ${closing ? "is-closing" : ""}`}
          onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) close(); }}
          onClick={(e) => { e.preventDefault(); setOpen(false); setClosing(false); pushOverlay(href); }}
        >
          결제 직접 입력
        </a>
      )}
      <button
        type="button" aria-label="결제 입력 메뉴" aria-expanded={open && !closing}
        onClick={() => (open && !closing ? close() : (setClosing(false), setOpen(true)))}
        className="add-plus grid h-10 w-10 place-items-center rounded-full text-[25px] text-accent"
      >
        <span aria-hidden>+</span>
      </button>
    </div>
  );
}
