"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useRef, useState, useTransition, type ReactNode, type RefObject } from "react";

type Switch = {
  /** 바꾸는 중인 달 이름(예: "2026년 9월"). 바꾸는 중이 아니면 null */
  pending: string | null;
  go: (href: string, label: string) => void;
};

const Ctx = createContext<Switch>({ pending: null, go: () => {} });
export const useMonthSwitch = () => use(Ctx);

/**
 * 홈에서 달을 바꾼다(한도 카드 밀기·달 링크). 새 달 데이터를 받는 동안 카드와 목록이
 * 함께 알 수 있게 한다: 카드는 새 달 이름과 자리표시를, 목록은 자리표시를 보인다.
 * 빠르게 여러 번 바꾸면 마지막 달로 간다.
 */
export function MonthSwitch({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const go = (href: string, label: string) => {
    setTarget(label);
    start(() => router.push(href, { scroll: false }));
  };
  return <Ctx value={{ pending: isPending ? target : null, go }}>{children}</Ctx>;
}

/** 바꾸던 달의 데이터가 도착하면 그 요소를 부드럽게 나타나게 한다 */
export function useArrive(ref: RefObject<HTMLElement | null>, pending: string | null) {
  const was = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (was.current && !pending && el?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
    }
    was.current = !!pending;
  }, [pending, ref]);
}

/** 한도 카드 아래(분류별 예산·거래 목록). 바꾸는 중에는 숨겨 두고(상태는 유지) 자리표시를 보인다. */
export function MonthBody({ children }: { children: ReactNode }) {
  const { pending } = useMonthSwitch();
  const body = useRef<HTMLDivElement>(null);
  useArrive(body, pending);
  return (
    <>
      {pending && (
        <div data-testid="month-skeleton" aria-hidden className="card skel mt-3 flex flex-col gap-3.5 !py-5">
          <i style={{ width: "38%" }} />
          <i style={{ width: "92%" }} />
          <i style={{ width: "74%" }} />
          <i style={{ width: "84%" }} />
        </div>
      )}
      <div ref={body} hidden={!!pending}>{children}</div>
    </>
  );
}
