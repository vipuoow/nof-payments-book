"use client";

import { useState } from "react";
import { findRuleCategory } from "@/app/tx-actions";
import { PASTE_ERROR, readPastedSms } from "@/ledger/paste-sms";
import { CheckButton } from "./check-button";

/** 붙여 넣은 문자에서 찾은 값. 분류는 가맹점 규칙이 있을 때만(없으면 undefined → 분류를 묻는다) */
export type PasteFill = { amount: number; merchant?: string; occurredAt?: Date; categoryId: string | undefined };
const CLIP_FAIL = "입력칸을 길게 눌러 붙여 넣어 주세요.";

/** 카드 문자 붙여넣기: 글을 읽어 채울 값을 넘긴다(원문은 서버로 보내지 않는다) */
export function PasteStep({ now, onBack, onRead, onDirect }: {
  now: Date; onBack: () => void; onRead: (fill: PasteFill) => void; onDirect: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noAmount, setNoAmount] = useState(false);

  async function fromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) throw new Error("empty");
      setText(t);
      setError(null);
      setNoAmount(false);
    } catch {
      setError(CLIP_FAIL);
    }
  }
  function check() {
    const r = readPastedSms(text, now);
    setNoAmount(!r.ok && r.reason === "no_amount");
    setError(r.ok ? null : PASTE_ERROR[r.reason]);
    return r.ok;
  }
  async function read() {
    const r = readPastedSms(text, now);
    if (!r.ok) return false;
    // 규칙을 못 찾아도(연결 끊김 포함) 분류만 물으면 된다
    const rule = r.merchant ? await findRuleCategory(r.merchant).catch(() => null) : null;
    onRead({ amount: r.amount, merchant: r.merchant, occurredAt: r.occurredAt, categoryId: rule ?? undefined });
    return true;
  }

  return (
    <>
      <div className="lx-bar">
        <button type="button" aria-label="뒤로" className="!text-[22px]" onClick={onBack}>‹</button>
        <span>카드 문자 붙여넣기</span>
        <span className="w-8" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-5">
        <textarea
          aria-label="결제 문자" value={text} onChange={(e) => setText(e.target.value)} rows={7}
          placeholder="여기에 결제 문자를 붙여 넣어요" className="paste-box"
        />
        <button type="button" onClick={fromClipboard} className="mx-auto px-4 py-2 text-sm font-semibold text-accent">붙여넣기</button>
        {error && <p key={error} role="alert" className="lx-msg text-center text-sm text-danger">{error}</p>}
        {noAmount && <button type="button" onClick={onDirect} className="mx-auto text-sm text-muted underline">직접 적기</button>}
      </div>
      <div className="lx-cta">
        <CheckButton label="읽기" validate={check} run={read} />
      </div>
    </>
  );
}
