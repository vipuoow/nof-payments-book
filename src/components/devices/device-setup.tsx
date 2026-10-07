"use client";

import { useActionState } from "react";
import { issueTokenAction } from "@/app/devices/actions";
import { DEVICE_LABEL, DEVICE_STEPS, IOS_SHORTCUT_PATH, connectionCode, deviceGuide, type Device } from "@/ledger/devices";
import { CopyField } from "./copy-field";

/**
 * 연결 코드(토큰) 발급 → 기종별 안내.
 * 아이폰: 미리 만든 단축어를 받아 연결 코드만 붙여넣는다. 갤럭시: 주소·헤더·본문을 직접 넣는다.
 */
export function DeviceSetup({ device, appUrl }: { device: Device; appUrl: string }) {
  const [state, formAction, pending] = useActionState(issueTokenAction, null);
  const token = state?.value ?? null;
  const heading = "mt-6 mb-2 font-semibold";
  return (
    <>
      <h2 className={heading}>1. 연결 코드 만들기</h2>
      <form action={formAction} className="flex gap-2">
        <input name="label" placeholder={`기기 이름 (예: 내 ${DEVICE_LABEL[device]})`} className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-base" />
        <button disabled={pending} className="shrink-0 rounded-lg bg-accent px-4 text-white disabled:opacity-50">연결 코드 만들기</button>
      </form>
      {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
      {token && (
        <div className="mt-3 rounded-xl border border-warning p-3">
          <p className="text-sm">이 화면을 벗어나면 다시 볼 수 없습니다. 설정을 마칠 때까지 이 화면을 열어 두세요.</p>
          <input type="hidden" value={token} data-testid="token-value" readOnly />
          {device === "iphone" && <CopyField label="연결 코드" value={connectionCode(appUrl, token)!} testId="copy-code" />}
        </div>
      )}

      {device === "iphone" ? <IphoneGuide /> : <AndroidGuide appUrl={appUrl} token={token} />}
    </>
  );
}

function IphoneGuide() {
  return (
    <>
      <h2 className="mt-6 mb-2 font-semibold">2. 단축어 받기</h2>
      <a href={IOS_SHORTCUT_PATH} className="block rounded-xl bg-accent py-3 text-center font-semibold text-white">
        단축어 받기
      </a>
      <h2 className="mt-6 mb-2 font-semibold">3. 아이폰 설정 순서</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {DEVICE_STEPS.iphone.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="mt-2 text-xs text-muted">아이폰 버전에 따라 메뉴 이름이 조금 다를 수 있습니다.</p>
    </>
  );
}

function AndroidGuide({ appUrl, token }: { appUrl: string; token: string | null }) {
  const guide = deviceGuide("android", appUrl, token);
  return (
    <>
      <h2 className="mt-6 mb-2 font-semibold">2. 갤럭시 설정</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {DEVICE_STEPS.android.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="mt-2 text-xs text-muted">휴대폰·앱 버전에 따라 메뉴 이름이 조금 다를 수 있습니다.</p>
      <h2 className="mt-6 mb-2 font-semibold">3. 복사할 값</h2>
      <CopyField label="주소" value={guide.url} testId="copy-url" />
      <CopyField label="헤더 Authorization" value={guide.headerValue} testId="copy-header" />
      <CopyField label="보낼 내용" value={guide.body} testId="copy-body" />
    </>
  );
}
