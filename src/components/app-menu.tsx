"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/session";

/** 메뉴. "파트너 잡으러 가기"는 그룹장에게, 파트너가 들어오기 전에만 보인다(showPartner). */
export function AppMenu({ me, showPartner }: { me: Me; showPartner: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const details = menu.current;
      if (details?.open && !details.contains(e.target as Node)) details.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const item = "rounded-lg px-3 py-2 active:bg-line";
  return (
    <details ref={menu} className="relative">
      <summary aria-label="메뉴" className="cursor-pointer list-none px-1 text-[20.8px] [&::-webkit-details-marker]:hidden">☰</summary>
      <nav className="absolute left-0 z-10 mt-2 flex w-48 flex-col rounded-xl bg-surface p-1 shadow-lg">
        <span className="px-3 py-2 text-sm text-muted">{me.displayName}님</span>
        <Link className={item} href="/limit">한도</Link>
        <Link className={item} href="/categories">카테고리</Link>
        <Link className={item} href="/devices">내 휴대폰 연결</Link>
        <Link className={item} href="/settings/theme">화면 모드</Link>
        {showPartner && <Link className={`${item} font-semibold text-accent`} href="/partner">파트너 잡으러 가기</Link>}
        {me.isOperator && <Link className={item} href="/operator">운영자</Link>}
        <form action={signOut}>
          <button className={`${item} w-full text-left text-danger`}>로그아웃</button>
        </form>
      </nav>
    </details>
  );
}
