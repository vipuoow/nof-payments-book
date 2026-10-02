"use client";

import { useActionState } from "react";
import { issueTokenAction } from "@/app/devices/actions";
import { DEVICE_LABEL, DEVICE_STEPS, deviceGuide, type Device } from "@/ledger/devices";
import { CopyField } from "./copy-field";

/** 토큰 발급 → 기종별 안내 → 복사할 값. 발급 직후에는 헤더 값에 실제 토큰이 들어간다. */
export function DeviceSetup({ device, appUrl }: { device: Device; appUrl: string }) {
  const [state, formAction, pending] = useActionState(issueTokenAction, null);
  const guide = deviceGuide(device, appUrl, state?.value ?? null);
  const heading = "mt-6 mb-2 font-semibold";
  return (
    <>
      <h2 className={heading}>1. 토큰 발급</h2>
      <form action={formAction} className="flex gap-2">
        <input name="label" placeholder={`기기 이름 (예: 내 ${DEVICE_LABEL[device]})`} className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-base" />
        <button disabled={pending} className="shrink-0 rounded-lg bg-accent px-4 text-white disabled:opacity-50">토큰 발급</button>
      </form>
      {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
      {state?.value && (
        <div className="mt-3 rounded-xl border border-warning p-3">
          <p className="mb-1 text-sm">기기 토큰 — 이 화면을 벗어나면 다시 볼 수 없습니다. 아래 헤더 값에 이미 들어 있습니다.</p>
          <input readOnly value={state.value} data-testid="token-value" onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg bg-surface px-3 py-2 font-mono text-base" />
        </div>
      )}

      <h2 className={heading}>2. {DEVICE_LABEL[device]} 설정</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {DEVICE_STEPS[device].map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="mt-2 text-xs text-muted">휴대폰·앱 버전에 따라 메뉴 이름이 조금 다를 수 있습니다.</p>

      <h2 className={heading}>3. 복사할 값</h2>
      <CopyField label="주소" value={guide.url} testId="copy-url" />
      <CopyField label="헤더 Authorization" value={guide.headerValue} testId="copy-header" />
      <CopyField label="보낼 내용" value={guide.body} testId="copy-body" />
    </>
  );
}
