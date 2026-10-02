"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

/** 아래에서 올라오는 모달 시트: 열리면 시트로 포커스, 열려 있는 동안 배경 스크롤 잠금. */
export function ModalSheet({ label, closeHref, children }: { label: string; closeHref: string; children: ReactNode }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      <Link href={closeHref} scroll={false} replace aria-label="닫기" className="absolute inset-0 bg-black/30" />
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative mx-auto max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-background p-4 pb-10 outline-none"
      >
        {children}
      </section>
    </div>
  );
}
