export type Device = "iphone" | "android";

export const DEVICE_LABEL: Record<Device, string> = { iphone: "아이폰", android: "갤럭시" };

/** 미리 만들어 서명한 아이폰 단축어 파일(public/ 아래, 주소·토큰은 들어 있지 않다) */
// 파일 이름이 단축어 앱에 추가될 때의 이름이 된다(scripts/build-ios-shortcut.py로 만든다)
export const IOS_SHORTCUT_PATH = `/shortcuts/${encodeURIComponent("가계부로 보내기")}.shortcut`;

/** 단축어에 붙여넣는 연결 코드: "받는 주소 토큰". 단축어가 공백으로 나눠 주소와 토큰으로 쓴다. */
export function connectionCode(appUrl: string, token: string | null): string | null {
  return token ? `${appUrl.replace(/\/+$/, "")}/api/ingest ${token}` : null;
}

export function parseDevice(value: string | string[] | undefined): Device {
  return value === "android" ? "android" : "iphone";
}

/** 복사할 값. 토큰은 발급 직후에만 알 수 있으므로 그 전에는 자리 표시. */
export function deviceGuide(device: Device, appUrl: string, token: string | null) {
  const source = device === "iphone" ? "ios_shortcut" : "android_macrodroid";
  return {
    url: `${appUrl.replace(/\/+$/, "")}/api/ingest`,
    headerValue: `Bearer ${token ?? "<토큰>"}`,
    body: JSON.stringify({ body: device === "iphone" ? "메시지 내용" : "[sms_message]", source }),
    source,
  };
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** 마지막 수신이 3일보다 오래되면 stale */
export function tokenHealth(lastUsedAt: string | null, now: Date): "never" | "stale" | "ok" {
  if (!lastUsedAt) return "never";
  return now.getTime() - new Date(lastUsedAt).getTime() > THREE_DAYS_MS ? "stale" : "ok";
}
