"use client";

import { useState } from "react";
import { convertForeign, findRuleCategory } from "@/app/tx-actions";
import { PASTE_ERROR, readPastedSms } from "@/ledger/paste-sms";
import { ChevronLeft } from "@/components/icons";
import { CheckButton } from "./check-button";

/** 붙여 넣은 문자에서 찾은 값. 분류는 가맹점 규칙이 있을 때만(없으면 undefined → 분류를 묻는다) */
/** note: 외화를 원화로 바꿨으면 계산 근거 */
export type PasteFill = { amount: number; merchant?: string; occurredAt?: Date; categoryId: string | undefined; note?: string };

const NO_RATE = "환율을 아직 받지 못했어요. 금액을 직접 적어 주세요.";

/** 결제문자 붙여넣기: 글을 읽어 채울 값을 넘긴다(원문은 서버로 보내지 않는다) */
export function PasteStep({ now, onBack, onRead, onDirect }: {
  now: Date; onBack: () => void; onRead: (fill: PasteFill) => void; onDirect: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noAmount, setNoAmount] = useState(false);

  function check() {
    const r = readPastedSms(text, now);
    setNoAmount(!r.ok && r.reason === "no_amount");
    setError(r.ok ? null : PASTE_ERROR[r.reason]);
    return r.ok;
  }
  async function read() {
    const r = readPastedSms(text, now);
    if (!r.ok) return false;
    let amount = r.amount;
    let note: string | undefined;
    if (amount === undefined && r.foreign) {
      const c = await convertForeign(r.foreign.currency, r.foreign.foreignAmount, (r.occurredAt ?? now).toISOString()).catch(() => null);
      if (!c) {
        setError(NO_RATE);
        setNoAmount(true);
        return false;
      }
      amount = c.amount;
      note = c.note;
    }
    if (amount === undefined) return false;
    // 규칙을 못 찾아도(연결 끊김 포함) 분류만 물으면 된다
    const rule = r.merchant ? await findRuleCategory(r.merchant).catch(() => null) : null;
    onRead({ amount, merchant: r.merchant, occurredAt: r.occurredAt, categoryId: rule ?? undefined, note });
    return true;
  }

  return (
    <>
      <div className="lx-bar">
        <button type="button" aria-label="뒤로" className="close-icon" onClick={onBack}><ChevronLeft /></button>
        <span>결제문자 붙여넣기</span>
        <span className="w-8" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-5">
        <textarea
          aria-label="결제 문자" value={text} onChange={(e) => setText(e.target.value)} rows={7}
          placeholder="여기에 결제 문자를 붙여 넣어요" className="paste-box"
        />
        {error && <p key={error} role="alert" className="lx-msg text-center text-sm text-danger">{error}</p>}
        {noAmount && <button type="button" onClick={onDirect} className="mx-auto text-sm text-muted underline">직접 입력</button>}
      </div>
      <div className="lx-cta">
        <CheckButton label="읽기" validate={check} run={read} />
      </div>
    </>
  );
}
