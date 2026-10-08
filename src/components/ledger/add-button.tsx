"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { pushOverlay } from "./overlay-history";

const OPEN_MS = 3000;
const LABEL = "결제 직접 입력";

/**
 * 홈 머리의 +(설계 2026-10-08 붙여넣기). 누르면 같은 버튼이 왼쪽으로 부드럽게 늘어나 [결제 직접 입력]이 되고,
 * 3초 동안 누르지 않거나 바깥을 누르면 다시 줄어 +로 돌아온다(×는 따로 없다).
 * 펼친 버튼을 누르면 그 자리에서 새로 추가(주소에 add=1)가 커진다(data-add-button).
 */
export function AddButton({ month }: { month: string }) {
  const href = `/?month=${month}&add=1`;
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  // 키보드(Enter·Space)로 펼쳤으면 버튼에 머무는 동안 접지 않는다
  const byKey = useRef(false);

  // 펼친 폭: 글자 폭 + 좌우 여백(글꼴이 늦게 와도 맞도록 열 때마다 잰다)
  useLayoutEffect(() => {
    if (open && measure.current) setWide(Math.ceil(measure.current.offsetWidth) + 36);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (byKey.current && document.activeElement === button.current) return;
      setOpen(false);
    }, OPEN_MS);
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => { window.clearTimeout(timer); document.removeEventListener("pointerdown", outside); };
  }, [open]);

  return (
    <div ref={box} className={`add-menu ${open ? "is-open" : ""}`}>
      <button
        ref={button} type="button" data-add-button
        aria-label={open ? undefined : "결제 입력 메뉴"} aria-expanded={open}
        style={open && wide ? { width: wide } : undefined}
        onClick={(e) => {
          if (!open) {
            byKey.current = e.detail === 0;
            return setOpen(true);
          }
          setOpen(false);
          pushOverlay(href);
        }}
        onBlur={() => { if (byKey.current) setOpen(false); }}
        className="add-fab"
      >
        <span aria-hidden className="add-fab-plus">+</span>
        <span className="add-fab-label">{LABEL}</span>
      </button>
      <span ref={measure} aria-hidden className="add-fab-label add-fab-measure">{LABEL}</span>
    </div>
  );
}
