"use client";

import { CloseX } from "@/components/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ignoreRawMessage } from "@/app/tx-actions";
import type { LedgerChoices, RawView } from "./home-types";
import { collapse } from "./motion";

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** 확인할 문자: 가계부가 못 읽은 문자. [무시]하면 접히고, [거래로 등록]이면 찾은 값을 미리 채운 새로 추가가 열린다 */
export function Inbox({
  raws, choices, onClose, onRegister, onToast,
}: {
  raws: RawView[]; choices: LedgerChoices; onClose: () => void; onRegister: (rawId: string) => void; onToast: (t: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const names = new Map(choices.members.map((m) => [m.userId, m.name]));

  function ignore(id: string, el: HTMLElement | null) {
    if (busy) return;
    setBusy(id);
    startTransition(async () => {
      const r = await ignoreRawMessage(id);
      if (!r.ok) {
        setBusy(null);
        onToast(r.error);
        router.refresh();
        return;
      }
      const finish = () => {
        setBusy(null);
        onToast("무시했어요");
        router.refresh();
      };
      if (el) collapse(el, finish);
      else finish();
    });
  }

  return (
    <>
      <div className="lx-bar lx-fade">
        <button type="button" onClick={onClose} aria-label="닫기" className="close-icon"><CloseX /></button>
        <span className="font-semibold text-foreground">확인할 문자</span>
        <span className="w-14" />
      </div>
      <p className="lx-fade px-5 pb-3 text-center text-xs text-muted">가계부가 읽지 못한 문자예요. 거래면 등록하고, 아니면 무시해 주세요.</p>
      <ul className="lx-fade flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pb-6">
        {raws.length === 0 && <li className="py-8 text-center text-muted">확인할 문자가 없어요</li>}
        {raws.map((r) => (
          <li key={r.id} data-testid="raw-item" className="rounded-[18px] bg-surface px-4 py-3.5">
            <p className="mb-1.5 text-xs text-muted">{names.get(r.userId) ?? ""} · {when(r.receivedAt)}</p>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed">{r.body}</pre>
            <div className="mt-2.5 flex justify-end gap-2 text-sm">
              <button
                type="button" disabled={busy !== null} className="rounded-xl bg-background px-3.5 py-2 text-muted disabled:opacity-50"
                onClick={(e) => ignore(r.id, e.currentTarget.closest("li"))}
              >
                무시
              </button>
              <button type="button" disabled={busy !== null} className="rounded-xl bg-accent px-3.5 py-2 font-semibold text-white disabled:opacity-50" onClick={() => onRegister(r.id)}>
                거래로 등록
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
