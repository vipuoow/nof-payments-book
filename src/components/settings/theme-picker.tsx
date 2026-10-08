"use client";

import { useState, useTransition } from "react";
import { setThemeAction } from "@/app/settings/theme/actions";
import type { Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; title: string; desc: string; swatch: string }[] = [
  { value: "basic", title: "기본", desc: "흰색에서 보라빛으로 번지는 부드러운 배경", swatch: "linear-gradient(160deg, #ffffff 0%, #f1eaff 55%, #dccffb 100%)" },
  { value: "light", title: "밝게", desc: "흰 카드와 연회색 바탕", swatch: "linear-gradient(#ffffff 0 50%, #f2f4f6 50%)" },
  { value: "dark", title: "어둡게", desc: "밤에 눈이 편한 어두운 화면", swatch: "linear-gradient(#1d1d22 0 50%, #101013 50%)" },
];

/** 이 화면에서 바로 미리 보기(새로고침하면 서버가 쿠키로 같은 모드를 그린다) */
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** 누르면 바로 화면이 바뀌고(미리 보기), 저장에 실패하면 원래대로 돌린다 */
export function ThemePicker({ current }: { current: Theme }) {
  const [theme, setTheme] = useState(current);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  function pick(next: Theme) {
    if (next === theme || pending) return;
    const before = theme;
    setTheme(next);
    setError(false);
    applyTheme(next);
    startTransition(async () => {
      const r = await setThemeAction(next);
      if (!r.ok) {
        setTheme(before);
        applyTheme(before);
        setError(true);
      }
    });
  }
  return (
    <div role="radiogroup" aria-label="화면 모드" className="flex flex-col gap-2.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={theme === o.value} onClick={() => pick(o.value)}
          className={`card flex items-center gap-3.5 !p-4 text-left outline-offset-2 ${theme === o.value ? "ring-2 ring-accent" : ""}`}
        >
          <span aria-hidden className="h-11 w-11 shrink-0 rounded-[14px] border border-line" style={{ background: o.swatch }} />
          <span className="min-w-0 flex-1">
            <b className="block text-[15px]">{o.title}</b>
            <small className="block text-xs text-muted">{o.desc}</small>
          </span>
          <span aria-hidden className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 ${theme === o.value ? "border-accent bg-accent" : "border-line"}`}>
            {theme === o.value && <span className="h-2 w-2 rounded-full bg-white" />}
          </span>
        </button>
      ))}
      {error && <p role="alert" className="text-sm text-danger">저장하지 못했어요. 다시 눌러 주세요.</p>}
    </div>
  );
}
