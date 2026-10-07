"use client";

import { useEffect, useRef, useState } from "react";
import { prepareGoogleNonce, signInWithIdTokenAction } from "@/app/login/google-actions";

type Gis = {
  accounts: {
    id: {
      initialize(o: { client_id: string; nonce: string; callback: (r: { credential: string }) => void; use_fedcm_for_button?: boolean }): void;
      renderButton(el: HTMLElement, o: Record<string, string | number>): void;
    };
  };
};

/**
 * Google 로그인을 우리 화면에서 직접 받는다(설계 4.2). Google 정책상 공식 버튼을 쓰되,
 * 다른 버튼과 같은 폭·높이(52px)의 흰 상자 가운데에 놓는다. 스크립트를 못 불러오면 fallback(리디렉트 버튼)을 보여 준다.
 */
export function GisButton({ clientId, next, fallback }: { clientId: string; next: string; fallback: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      const nonce = await prepareGoogleNonce();
      const g = (window as unknown as { google?: Gis }).google;
      if (cancelled || !g || !box.current) return;
      g.accounts.id.initialize({
        client_id: clientId,
        nonce,
        callback: (r) => { void signInWithIdTokenAction(r.credential, next); },
      });
      g.accounts.id.renderButton(box.current, {
        type: "standard", theme: "outline", size: "large", shape: "rectangular", text: "continue_with",
        logo_alignment: "center", locale: "ko", width: Math.min(box.current.clientWidth, 400),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>("script[data-gis]");
    if (existing && (window as unknown as { google?: Gis }).google) { void start(); return () => { cancelled = true; }; }
    const script = existing ?? Object.assign(document.createElement("script"), { src: "https://accounts.google.com/gsi/client", async: true });
    script.dataset.gis = "1";
    script.addEventListener("load", () => void start());
    script.addEventListener("error", () => setFailed(true));
    if (!existing) document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [clientId, next]);

  if (failed) return <>{fallback}</>;
  return (
    <div className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-white shadow-[0_6px_20px_rgb(0_0_0/.25)]">
      <div ref={box} className="flex w-full justify-center px-2" aria-label="Google로 계속하기" />
    </div>
  );
}
