"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckMark, checkThen } from "./check-button";
import { pushOverlay } from "./overlay-history";

const OPEN_MS = 3000;
const BYE_MS = 520;
const LABEL = "결제 직접 입력";

type State = "closed" | "open" | "bye" | "checked";

/**
 * 홈 머리의 +(설계 2026-10-08 붙여넣기).
 * - 누르면 같은 버튼이 "쇽" 하고 살짝 튕기듯 늘어나 [결제 직접 입력]이 되고, 아래에 3초가 흘러가는 줄이 보인다.
 * - 시간이 다 되거나 바깥을 누르면 글자가 "bye bye~" 손 흔들 듯 흔들린 뒤 줄어 +로 돌아온다(×는 따로 없다).
 * - 펼친 버튼을 누르면 ✓로 바뀌며 빛이 퍼지고, 그 자리에서 새로 추가(주소에 add=1)가 커진다(data-add-button).
 */
export function AddButton({ month }: { month: string }) {
  const href = `/?month=${month}&add=1`;
  const [state, setState] = useState<State>("closed");
  const [wide, setWide] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const byeTimer = useRef<number | undefined>(undefined);
  // 키보드(Enter·Space)로 펼쳤으면 버튼에 머무는 동안 접지 않는다
  const [byKey, setByKey] = useState(false);
  const open = state === "open" || state === "checked";
  const wideNow = state !== "closed";

  // 펼친 폭: 글자 폭 + 좌우 여백(글꼴이 늦게 와도 맞도록 열 때마다 잰다)
  useLayoutEffect(() => {
    if (state === "open" && measure.current) setWide(Math.ceil(measure.current.offsetWidth) + 36);
  }, [state]);

  function bye() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setState("closed");
    setState("bye");
    window.clearTimeout(byeTimer.current);
    byeTimer.current = window.setTimeout(() => setState((s) => (s === "bye" ? "closed" : s)), BYE_MS);
  }

  useEffect(() => {
    if (state !== "open") return;
    const timer = window.setTimeout(() => {
      if (byKey && document.activeElement === button.current) return;
      bye();
    }, OPEN_MS);
    const outside = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) bye(); };
    document.addEventListener("pointerdown", outside);
    return () => { window.clearTimeout(timer); document.removeEventListener("pointerdown", outside); };
  }, [state, byKey]);
  useEffect(() => () => window.clearTimeout(byeTimer.current), []);

  return (
    <div ref={box} className={`add-menu is-${state}`}>
      <button
        ref={button} type="button" data-add-button
        aria-label={open ? undefined : "결제 입력 메뉴"} aria-expanded={open} aria-busy={state === "checked" || undefined}
        style={wideNow && wide ? { width: wide } : undefined}
        onClick={(e) => {
          if (state === "checked") return;
          if (state !== "open") {
            window.clearTimeout(byeTimer.current);
            setByKey(e.detail === 0);
            return setState("open");
          }
          setState("checked");
          checkThen(e.currentTarget, () => {
            pushOverlay(href);
            setState("closed");
          });
        }}
        onBlur={() => { if (byKey && state === "open") bye(); }}
        className="add-fab"
      >
        <span aria-hidden className="add-fab-plus">+</span>
        <span className="add-fab-label">{LABEL}</span>
        <span aria-hidden className="add-fab-check"><CheckMark /></span>
        {state === "open" && <span aria-hidden className={`add-fab-timer ${byKey ? "is-paused" : ""}`} />}
      </button>
      <span ref={measure} aria-hidden className="add-fab-label add-fab-measure">{LABEL}</span>
    </div>
  );
}
