"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";

/** 체크가 그려지고 빛이 번지는 시간. 고르기·입력 끝내기는 모두 이 시간 뒤에 넘어간다 */
export const CHECK_MS = 430;
/** 저장 요청이 서버에 닿지 못했을 때(연결 끊김) */
export const OFFLINE = "저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.";

/**
 * 입력을 확정하는 버튼(다음·고쳤어요·다 입력했어요·확인·저장하기, 설계 2026-10-08).
 * 누르면 검사(validate) → 통과하면 버튼이 동그랗게 줄며 ✓가 그려지고, 버튼 자리에서 빛이 화면으로 번진 뒤 run을 한다.
 * run이 false를 돌려주면(저장 실패 등) 버튼을 되돌린다. 체크 중에는 다시 눌리지 않는다.
 * keep: 성공한 뒤에도 체크 모양을 유지한다(저장 뒤 화면이 닫힐 때).
 * ref.press(): Enter 키도 버튼과 같은 길(검사·두 번 누르기 막음·체크)로 넘긴다.
 */
export type CheckButtonHandle = { press: () => void };

export function CheckButton({
  label, validate, run, keep = false, disabled = false, ref,
}: {
  label: string; validate?: () => boolean; run: () => boolean | void | Promise<boolean | void>; keep?: boolean; disabled?: boolean;
  ref?: Ref<CheckButtonHandle>;
}) {
  const [checking, setChecking] = useState(false);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({ press: () => void press() }));

  async function press() {
    // 상태는 다음 그리기 때 바뀌므로, 같은 순간 두 번 눌러도 한 번만 지나가게 ref로도 막는다
    if (busy.current || disabled) return;
    if (validate && !validate()) return;
    busy.current = true;
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
    busy.current = false;
    if (ok && keep) setDone(true);
    else setChecking(false);
  }

  return (
    <button
      ref={button} type="button" disabled={disabled} onClick={press}
      aria-label={checking ? (done ? `${label} 완료` : label) : undefined}
      aria-busy={checking && !done}
      className={`lx-btn check-btn ${checking ? "is-checking" : ""}`}
    >
      {checking
        ? <CheckMark />
        : label}
    </button>
  );
}

/** 체크 표시(그려지듯 나타남). 버튼·고르기 카드·홈 + 버튼이 같이 쓴다 */
export function CheckMark() {
  return <svg className="check-mark" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}

/** 고르기·입력 끝내기의 공통 움직임: 그 자리에서 빛이 은은하게 퍼진 뒤(동작 줄이기면 바로) next를 한다 */
export function checkThen(from: HTMLElement | null, next: () => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return next();
  if (from) glow(from);
  window.setTimeout(next, CHECK_MS);
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
