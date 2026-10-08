"use client";

import { useEffect, useRef, useState } from "react";
import { kstTime } from "@/ledger/month";
import { formatWon } from "@/ledger/summary";
import type { DayView, LedgerChoices, RowTx } from "./home-types";

const OPEN_X = -76;

type Drag = { id: string; manual: boolean; x: number; y: number; base: number; dx: number; moved: boolean };

/**
 * 날짜별 거래 목록. 줄을 누르면 상세가 열리고, 왼쪽으로 밀면 휴지통이 나온다(직접 추가한 거래만).
 * 카드 문자 거래는 살짝만 움직였다가 돌아오고 지울 수 없다고 알려 준다.
 */
export function TxRows({
  days, hrefOf, choices, onOpen, onAskDelete, onToast, openSwipe, setOpenSwipe,
}: {
  days: DayView[];
  hrefOf: (id: string) => string;
  choices: LedgerChoices;
  onOpen: (id: string) => void;
  onAskDelete: (id: string) => void;
  onToast: (text: string) => void;
  openSwipe: string | null;
  setOpenSwipe: (id: string | null) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const names = new Map(choices.members.map((m) => [m.userId, m.name]));

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.abs(dx) < 6) return;
      // 세로로 더 움직이면 목록 스크롤로 본다
      if (!d.moved && Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null;
        setDrag(null);
        return;
      }
      let x = Math.min(0, d.base + dx);
      if (!d.manual) x = Math.max(-18, x * 0.25);
      const next = { ...d, moved: true, dx: x };
      dragRef.current = next;
      suppressClick.current = true;
      setDrag(next);
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d?.moved) return;
      if (!d.manual) onToast("카드 문자로 들어온 거래는 지울 수 없어요");
      else setOpenSwipe(d.dx < -40 ? d.id : null);
      window.setTimeout(() => { suppressClick.current = false; }, 50);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [onToast, setOpenSwipe]);

  if (days.length === 0) return <p className="py-12 text-center text-muted">이 달에는 거래가 없어요</p>;

  const offset = (t: RowTx) => (drag?.id === t.id ? drag.dx : openSwipe === t.id ? OPEN_X : 0);

  return (
    <div className="mt-2">
      {days.map((g) => (
        <section key={g.key}>
          <h2 className="tabular flex justify-between px-1 pb-2 pt-5 text-xs font-medium text-muted">
            <span>{g.label}</span>
            {/* 월 합계와 같은 방식: 취소는 음수라 그대로 더한다 */}
            <span data-testid="day-total">{formatWon(g.total)}원</span>
          </h2>
          <ul className="overflow-hidden rounded-[20px] bg-surface py-0.5 shadow-[var(--card-shadow)]">
            {g.items.map((t) => {
              const category = t.categoryId ? choices.categoryNames[t.categoryId] : undefined;
              const manual = t.kind === "manual";
              const x = offset(t);
              return (
                <li key={t.id} className="lx-swipe border-line [&+&]:border-t" data-swipe-id={t.id}>
                  {manual && x < 0 && (
                    <button type="button" className="lx-trash" onClick={() => onAskDelete(t.id)}>지우기</button>
                  )}
                  <a
                    data-testid="tx-row"
                    data-row-id={t.id}
                    href={hrefOf(t.id)}
                    draggable={false}
                    className={`lx-row flex items-center gap-3 px-4 py-[11px] ${drag?.id === t.id ? "lx-dragging" : ""}`}
                    style={x ? { transform: `translateX(${x}px)` } : undefined}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      const d = { id: t.id, manual, x: e.clientX, y: e.clientY, base: openSwipe === t.id ? OPEN_X : 0, dx: 0, moved: false };
                      dragRef.current = d;
                      suppressClick.current = false;
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      if (suppressClick.current) return;
                      // 휴지통이 열린 줄을 누르면 닫기만 한다
                      if (openSwipe) {
                        setOpenSwipe(null);
                        if (openSwipe === t.id) return;
                      }
                      onOpen(t.id);
                    }}
                  >
                    <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold ${category ? "bg-accent-soft text-accent" : "bg-accent-soft text-muted"}`}>
                      {category ? category.slice(0, 1) : "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{t.merchant}</span>
                      <span className="block truncate text-xs text-muted">
                        {category ?? "미지정"} · <span data-testid="tx-time" className="tabular">{kstTime(new Date(t.occurredAt))}</span>
                        {" · "}{names.get(t.userId) ?? ""}{t.categorySource === "ai" ? " · 자동" : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className={`tabular text-[15px] font-semibold ${t.cancelled ? "text-muted line-through" : ""}`}>{formatWon(t.amount)}원</span>
                      <span data-testid="tx-card" className="text-xs text-muted">{t.card}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
