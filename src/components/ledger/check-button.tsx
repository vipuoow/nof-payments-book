"use client";

import { useRef, useState } from "react";

const CHECK_MS = 430;

/**
 * 입력을 확정하는 버튼(다음·고쳤어요·다 입력했어요·확인·저장하기, 설계 2026-10-08).
 * 누르면 검사(validate) → 통과하면 버튼이 동그랗게 줄며 ✓가 그려지고, 버튼 자리에서 빛이 화면으로 번진 뒤 run을 한다.
 * run이 false를 돌려주면(저장 실패 등) 버튼을 되돌린다. 체크 중에는 다시 눌리지 않는다.
 * keep: 성공한 뒤에도 체크 모양을 유지한다(저장 뒤 화면이 닫힐 때).
 */
export function CheckButton({
  label, validate, run, keep = false, disabled = false,
}: { label: string; validate?: () => boolean; run: () => boolean | void | Promise<boolean | void>; keep?: boolean; disabled?: boolean }) {
  const [checking, setChecking] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  async function press() {
    if (checking || disabled) return;
    if (validate && !validate()) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setChecking(true);
    if (!reduce && button.current) glow(button.current);
    if (!reduce) await new Promise((r) => setTimeout(r, CHECK_MS));
    let ok = true;
    try {
      ok = (await run()) !== false;
    } catch {
      ok = false;
    }
    if (!ok || !keep) setChecking(false);
  }

  return (
    <button
      ref={button} type="button" disabled={disabled} onClick={press}
      aria-label={checking ? `${label} 완료` : undefined}
      className={`lx-btn check-btn ${checking ? "is-checking" : ""}`}
    >
      {checking
        ? <svg className="check-mark" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        : label}
    </button>
  );
}

/** 버튼 가운데에서 화면 전체로 번지는 빛(옅은 물결 + 얇은 빛 고리) */
function glow(from: HTMLElement) {
  const b = from.getBoundingClientRect();
  const size = Math.hypot(window.innerWidth, window.innerHeight) * 2;
  const el = document.createElement("span");
  el.className = "check-glow";
  el.style.width = el.style.height = `${size}px`;
  el.style.left = `${b.left + b.width / 2 - size / 2}px`;
  el.style.top = `${b.top + b.height / 2 - size / 2}px`;
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}
