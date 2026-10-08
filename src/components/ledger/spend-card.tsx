"use client";

import Link from "next/link";
import { useRef } from "react";
import { limitView } from "@/ledger/budget";
import { formatWon, type Member } from "@/ledger/summary";
import { koWon } from "@/ledger/won";
import { useArrive, useMonthSwitch } from "./month-switch";

type MonthLink = { href: string; month: number; label: string };
type MonthNav = { label: string; prev: MonthLink; next: MonthLink | null };

/**
 * 홈 맨 위 한도 카드(설계 2026-10-08 B안).
 * 한도 → 쓴 돈(상태색) → 사람별 → 굵은 막대(끝까지가 한도, 남은 칸 안에 남은 돈 또는 문구).
 * 카드를 손가락으로 옆으로 밀면 달이 바뀐다(이번 달보다 뒤로는 못 감).
 * 바꿀 때 카드는 사라지지 않고 가운데로 미끄러져 돌아오며, 새 달 이름과 자리표시를 보이다가 데이터가 오면 채운다.
 */
export function SpendCard({
  nav, total, byMember, limit,
}: { nav: MonthNav; total: number; byMember: Array<Member & { amount: number }>; limit: number | null }) {
  const { pending, go: switchTo } = useMonthSwitch();
  const slide = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; on: boolean } | null>(null);
  const dragged = useRef(false);
  const view = limit ? limitView(total, limit) : null;
  useArrive(body, pending);

  function go(dir: -1 | 1) {
    const target = dir < 0 ? nav.prev : nav.next;
    settle();
    if (target) switchTo(target.href, target.label);
  }
  /** 끌던 자리에서 가운데로 미끄러져 돌아온다 */
  function settle() {
    const el = slide.current;
    if (!el) return;
    const from = el.style.transform;
    el.style.transform = "";
    if (from && el.animate && !reduced()) {
      el.animate([{ transform: from }, { transform: "none" }], { duration: 250, easing: "cubic-bezier(.2,.8,.2,1)" });
    }
  }
  /** 달 링크: 주소는 그대로 두고(새 탭 등), 누르면 같은 방식으로 바꾼다 */
  function linkTo(target: MonthLink) {
    return (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      switchTo(target.href, target.label);
    };
  }
  /** 끌기를 끝낸다. 뗀 바로 뒤의 클릭만 막고, 그 뒤 키보드로 링크를 여는 것은 막지 않는다. */
  function release() {
    drag.current = null;
    window.setTimeout(() => { dragged.current = false; }, 0);
  }

  return (
    <section
      className="card spend-card !pb-4 !pt-4"
      aria-busy={pending ? true : undefined}
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, dx: 0, on: false }; dragged.current = false; }}
      // 밀다가 손을 뗀 곳이 달 링크여도 눌린 것으로 치지 않는다
      onClickCapture={(e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); } }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        // 카드 밖에서 마우스를 뗐으면 끌기를 끝낸다
        if (e.pointerType === "mouse" && e.buttons === 0) { release(); settle(); return; }
        const dx = e.clientX - d.x;
        if (!d.on) {
          if (Math.abs(dx) < 8) return;
          if (Math.abs(e.clientY - d.y) > Math.abs(dx)) { drag.current = null; return; }
          d.on = true;
          dragged.current = true;
          // 끌기가 시작된 뒤에만 잡는다(그냥 누른 링크는 그대로 열리게)
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }
        // 갈 수 없는 쪽(다음 달이 없을 때)은 살짝만 끌린다
        d.dx = dx < 0 && !nav.next ? dx * 0.25 : dx;
        if (slide.current) slide.current.style.transform = `translateX(${d.dx}px)`;
      }}
      onPointerUp={() => {
        const d = drag.current;
        release();
        if (!d?.on) return;
        if (d.dx > 60) go(-1);
        else if (d.dx < -60 && nav.next) go(1);
        else settle();
      }}
      onPointerCancel={() => { release(); settle(); }}
      // 손가락은 처음 닿은 안쪽 요소에 묶였다가 카드로 옮겨지며, 그때 안쪽 요소의 '놓침'이 올라온다. 카드 자신의 것만 본다.
      onLostPointerCapture={(e) => { if (e.target === e.currentTarget && drag.current) { release(); settle(); } }}
    >
      <div ref={slide} className="spend-slide">
        <div className="grid grid-cols-[4rem_1fr_4rem] items-center text-[13px]">
          {pending
            ? <span aria-hidden />
            : <Link href={nav.prev.href} scroll={false} onClick={linkTo(nav.prev)} aria-label="이전 달" className="text-muted">‹ {nav.prev.month}월</Link>}
          <h1 className="text-center text-[15px] font-bold">{pending ?? nav.label}</h1>
          {nav.next && !pending
            ? <Link href={nav.next.href} scroll={false} onClick={linkTo(nav.next)} aria-label="다음 달" className="text-right text-muted">{nav.next.month}월 ›</Link>
            : <span aria-hidden />}
        </div>
        {pending ? (
          <div className="spend skel mt-3 flex flex-col gap-2.5" aria-hidden>
            <i style={{ width: "34%", height: 12 }} />
            <i style={{ width: "58%", height: 26 }} />
            <i style={{ width: "46%", height: 11 }} />
            <i style={{ width: "100%", height: 22, marginTop: 4, borderRadius: 99 }} />
          </div>
        ) : (
          <div ref={body} className="spend" data-level={view?.level ?? "none"}>
            {view && limit && <p className="spend-limit">한도 {koWon(limit)}원 중</p>}
            <p data-testid="family-total" className="spend-total tabular truncate whitespace-nowrap">
              <b>{formatWon(total)}원</b> 썼어요
            </p>
            <p className="tabular mt-1 truncate whitespace-nowrap text-xs text-muted">
              {byMember.map((m) => `${m.name} ${formatWon(m.amount)}원`).join(" | ")}
            </p>
            {view && (
              <div
                data-testid="budget-total" role="meter" aria-label="한도 사용" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={Math.round(view.fill * 100)} aria-valuetext={view.label}
                className={`spend-bar ${view.tight ? "tight" : ""}`}
              >
                <i style={{ width: `${view.fill * 100}%` }} />
                <span className="spend-rest" style={view.tight ? { right: `calc(${(1 - view.fill) * 100}% + 10px)` } : undefined}>
                  {view.label}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
