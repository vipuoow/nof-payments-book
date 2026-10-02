"use client";

import { useRef, useState } from "react";

/** 읽기 전용 값과 [복사]. 클립보드가 막히면 값을 선택해 두고 길게 눌러 복사하라고 안내한다. */
export function CopyField({ label, value, testId }: { label: string; value: string; testId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="py-2">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          readOnly
          value={value}
          data-testid={testId}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 font-mono text-base"
        />
        <button
          type="button"
          className="shrink-0 text-accent"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setMessage("복사됨");
            } catch {
              input.current?.select();
              setMessage("길게 눌러 복사해 주세요.");
            }
          }}
        >
          복사
        </button>
      </div>
      {message && <p role="status" className="mt-1 text-xs text-muted">{message}</p>}
    </div>
  );
}
