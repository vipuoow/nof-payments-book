"use client";

import { ChevronLeft } from "@/components/icons";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { issueTokenAction } from "@/app/devices/actions";
import { DEVICE_LABEL, IOS_SHORTCUT_PATH, connectionCode, deviceGuide, type Device } from "@/ledger/devices";
import { guideSteps, type Cards, type CopyKey } from "@/ledger/guide";
import { CopyField } from "./copy-field";
import { GuideIllus } from "./guide-illus";

const STORE_URL = "https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid";

/** 화면으로 따라 하는 휴대폰 연결 안내: 한 화면에 한 단계, 위쪽에 진행 정도 */
export function ConnectGuide({ device, appUrl }: { device: Device; appUrl: string }) {
  const [cards, setCards] = useState<Cards>({ kb: true, hyundai: true });
  const [index, setIndex] = useState(0);
  const [state, issue, issuing] = useActionState(issueTokenAction, null);
  const token = state?.value ?? null;
  const steps = guideSteps(device, cards);
  const step = steps[index];
  const other: Device = device === "iphone" ? "android" : "iphone";

  const values: Record<CopyKey, string> = {
    code: connectionCode(appUrl, token) ?? "",
    kb: "KB국민카드",
    hyundai: "현대",
    ...(() => {
      const g = deviceGuide(device, appUrl, token);
      return { url: g.url, header: g.headerValue, body: g.body };
    })(),
  };
  const needsToken = step.copies?.some((c) => c.key === "code" || c.key === "header");
  const canGoOn = step.action === "cards" ? cards.kb || cards.hyundai : step.action === "issue" ? token !== null : true;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between py-3">
        {index > 0
          ? <button type="button" aria-label="이전 단계" onClick={() => setIndex(index - 1)} className="nav-icon"><ChevronLeft /></button>
          : <Link href="/" aria-label="홈" className="nav-icon"><ChevronLeft /></Link>}
        <span className="text-sm text-muted">{index + 1} / {steps.length}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-accent" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
      </div>

      <section className="flex flex-1 flex-col gap-3 px-1 pt-5">
        <h1 className="text-2xl font-bold">{step.title}</h1>
        {step.body && <p className="text-muted">{step.body}</p>}

        {step.action === "cards" && (
          <fieldset className="mt-3 flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">쓰는 카드를 골라 주세요</legend>
            {(["kb", "hyundai"] as const).map((k) => (
              <label key={k} className={`flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 ${cards[k] ? "border-accent" : "border-line"}`}>
                <input type="checkbox" checked={cards[k]} onChange={(e) => setCards({ ...cards, [k]: e.target.checked })} className="h-5 w-5 accent-accent" />
                {k === "kb" ? "KB국민카드" : "현대카드"}
              </label>
            ))}
          </fieldset>
        )}

        <div className="mt-2"><GuideIllus id={step.id} /></div>

        {step.action === "issue" && !token && (
          <form action={issue}>
            <input type="hidden" name="label" value={`내 ${DEVICE_LABEL[device]}`} />
            <button disabled={issuing} className="w-full rounded-xl bg-accent-soft py-3 font-semibold text-accent disabled:opacity-50">연결 코드 만들기</button>
            {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
          </form>
        )}
        {token && <input type="hidden" value={token} data-testid="token-value" readOnly />}
        {(!needsToken || token) && step.copies?.map((c) => (
          <CopyField key={c.key} label={c.label} value={values[c.key]} testId={`copy-${c.key}`} />
        ))}
        {needsToken && !token && step.action !== "issue" && (
          <p className="text-sm text-danger">연결 코드를 먼저 만들어 주세요. 앞 단계로 돌아가요.</p>
        )}

        {step.action === "check" && <ConnectionCheck />}
      </section>

      <div className="flex flex-col gap-2 pt-6">
        {step.action === "shortcut" && (
          <a href={IOS_SHORTCUT_PATH} className="block rounded-2xl bg-accent-soft py-4 text-center font-semibold text-accent">단축어 받기</a>
        )}
        {step.action === "store" && (
          <a href={STORE_URL} target="_blank" rel="noreferrer" className="block rounded-2xl bg-accent-soft py-4 text-center font-semibold text-accent">Play 스토어 열기</a>
        )}
        {step.action !== "check" && (
          <button type="button" disabled={!canGoOn} onClick={() => setIndex(index + 1)}
            className="rounded-2xl bg-accent py-4 font-semibold text-white disabled:opacity-40">
            {step.action === "cards" ? "시작하기" : "다 했어요"}
          </button>
        )}
        {index === 0 && (
          <p className="text-center text-xs text-muted">
            {DEVICE_LABEL[other]}인가요? <Link href={`/devices?device=${other}`} replace className="text-accent underline">{DEVICE_LABEL[other]} 안내로 바꾸기</Link>
          </p>
        )}
      </div>
    </div>
  );
}

/** 마지막 단계: 3초마다 내 휴대폰 연결 여부를 묻고, 문자가 도착하면 "연결됐어요!" */
function ConnectionCheck() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (connected) return;
    let alive = true;
    const ask = async () => {
      try {
        const res = await fetch("/api/connection", { cache: "no-store" });
        const body = (await res.json()) as { meConnected?: boolean };
        if (alive && body.meConnected) setConnected(true);
      } catch {
        // 네트워크가 잠깐 끊겨도 다음 확인에서 다시 묻는다
      }
    };
    const timer = setInterval(ask, 3000);
    void ask();
    return () => { alive = false; clearInterval(timer); };
  }, [connected]);

  return connected ? (
    <div className="mt-2 flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-6 text-center">
      <span className="h-3.5 w-3.5 rounded-full bg-ok" />
      <b className="text-lg text-ok">연결됐어요!</b>
      <span className="text-sm text-muted">이제 카드로 결제하면 자동으로 기록돼요.</span>
      <Link href="/" className="mt-3 w-full rounded-2xl bg-accent py-4 font-semibold text-white">홈으로</Link>
    </div>
  ) : (
    <div role="status" className="mt-2 flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-6 text-center">
      <span className="h-3.5 w-3.5 rounded-full bg-line motion-safe:animate-pulse" />
      <b>연결 확인 중</b>
      <span className="text-sm text-muted">시험 문자가 도착하면 바로 바뀌어요.</span>
    </div>
  );
}
