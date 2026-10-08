"use client";

import { useState } from "react";

/** 주소 복사(앱 안 브라우저에서 Safari로 옮길 때). 클립보드가 막히면 주소를 보여 준다 */
export function CopyAddress({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(url); setState("copied"); } catch { setState("manual"); }
        }}
        className="rounded-xl bg-white py-2.5 font-semibold text-[#1f1f1f]"
      >
        주소 복사
      </button>
      {state === "copied" && <p role="status" className="text-sm">복사했어요. 브라우저 주소창에 붙여넣어 주세요.</p>}
      {state === "manual" && <input aria-label="가계부 주소" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="rounded-lg bg-white px-2 py-1.5 text-xs text-[#1f1f1f]" />}
    </div>
  );
}
