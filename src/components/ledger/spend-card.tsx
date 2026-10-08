"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { limitView } from "@/ledger/budget";
import { formatWon, type Member } from "@/ledger/summary";
import { koWon } from "@/ledger/won";

type MonthNav = { label: string; prev: { href: string; month: number }; next: { href: string; month: number } | null };

/**
 * 홈 맨 위 한도 카드(설계 2026-10-08 B안).
 * 한도 → 쓴 돈(상태색) → 사람별 → 굵은 막대(끝까지가 한도, 남은 칸 안에 남은 돈 또는 문구).
 * 카드를 손가락으로 옆으로 밀면 달이 바뀐다(이번 달보다 뒤로는 못 감).
 */
export function SpendCard({
  nav, total, byMember, limit,
}: { nav: MonthNav; total: number; byMember: Array<Member & { amount: number }>; limit: number | null }) {
  const router = useRouter();
  const slide = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; on: boolean } | null>(null);
  const entering = useRef<number>(0);
  const dragged = useRef(false);
  const view = limit ? limitView(total, limit) : null;

  // 달이 바뀌면 민 방향의 반대쪽에서 들어온다
  useEffect(() => {
    const el = slide.current;
    const dir = entering.current;
    entering.current = 0;
    if (!el || !dir || reduced() || !el.animate) return;
    // 나가는 움직임은 끝 모습(투명)을 붙잡고 있으므로 먼저 지운다
    el.getAnimations().forEach((a) => a.cancel());
    el.animate([{ transform: `translateX(${dir * 60}%)`, opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
  }, [nav.label]);

  function go(dir: -1 | 1) {
    const target = dir < 0 ? nav.prev.href : nav.next?.href;
    const el = slide.current;
    if (!target) return bounce();
    entering.current = -dir;
    if (el && !reduced() && el.animate) {
      el.animate([{ transform: el.style.transform || "none" }, { transform: `translateX(${-dir * 110}%)`, opacity: 0 }],
        { duration: 200, easing: "ease-in", fill: "forwards" }).onfinish = () => router.push(target, { scroll: false });
      el.style.transform = "";
    } else router.push(target, { scroll: false });
  }
  function bounce() {
    const el = slide.current;
    if (el) el.style.transform = "";
  }
  /** 끌기를 끝낸다. 뗀 바로 뒤의 클릭만 막고, 그 뒤 키보드로 링크를 여는 것은 막지 않는다. */
  function release() {
    drag.current = null;
    window.setTimeout(() => { dragged.current = false; }, 0);
  }

  return (
    <section
      className="card spend-card !pb-4 !pt-4"
      onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, dx: 0, on: false }; dragged.current = false; }}
      // 밀다가 손을 뗀 곳이 달 링크여도 눌린 것으로 치지 않는다
      onClickCapture={(e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); } }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        // 카드 밖에서 마우스를 뗐으면 끌기를 끝낸다
        if (e.pointerType === "mouse" && e.buttons === 0) { release(); bounce(); return; }
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
        else bounce();
      }}
      onPointerCancel={() => { release(); bounce(); }}
      // 손가락은 처음 닿은 안쪽 요소에 묶였다가 카드로 옮겨지며, 그때 안쪽 요소의 '놓침'이 올라온다. 카드 자신의 것만 본다.
      onLostPointerCapture={(e) => { if (e.target === e.currentTarget && drag.current) { release(); bounce(); } }}
    >
      <div ref={slide} className="spend-slide">
        <div className="grid grid-cols-[4rem_1fr_4rem] items-center text-[13px]">
          <Link href={nav.prev.href} scroll={false} aria-label="이전 달" className="text-muted">‹ {nav.prev.month}월</Link>
          <h1 className="text-center text-[15px] font-bold">{nav.label}</h1>
          {nav.next
            ? <Link href={nav.next.href} scroll={false} aria-label="다음 달" className="text-right text-muted">{nav.next.month}월 ›</Link>
            : <span aria-hidden />}
        </div>
        <div className="spend" data-level={view?.level ?? "none"}>
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
      </div>
    </section>
  );
}

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
