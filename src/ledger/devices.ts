export type Device = "iphone" | "android";

export const DEVICE_LABEL: Record<Device, string> = { iphone: "아이폰", android: "갤럭시" };

/** 기종별 설정 안내. 메뉴 이름은 OS·앱 버전에 따라 조금 다를 수 있다. */
export const DEVICE_STEPS: Record<Device, string[]> = {
  iphone: [
    "단축어 앱을 열고 [자동화] → [+] → [메시지]를 고릅니다.",
    "\"메시지에 다음이 포함됨\"에 KB국민카드를 넣고, [즉시 실행]을 켠 뒤 [다음]을 누릅니다.",
    "[새로운 빈 단축어]를 고르고 동작 [URL 콘텐츠 가져오기]를 추가합니다.",
    "URL에 아래 주소를 붙여넣고, 방법을 POST로, 헤더에 Authorization = 아래 헤더 값을 넣습니다.",
    "본문을 JSON으로 하고 body = 단축어 입력의 [메시지 내용], source = ios_shortcut 을 넣습니다.",
    "결제 후 홈에 거래가 나타나는지 확인합니다.",
  ],
  android: [
    "MacroDroid 앱을 설치하고 [매크로 추가]를 누릅니다.",
    "트리거 [SMS 수신]을 고르고, 내용에 KB국민카드가 포함될 때로 정합니다.",
    "동작 [HTTP 요청]을 추가해 방법 POST, URL에 아래 주소, 헤더에 Authorization = 아래 헤더 값을 넣습니다.",
    "콘텐츠 유형을 application/json으로 하고, 본문에 아래 보낼 내용을 붙여넣습니다([sms_message]가 문자 내용 자리입니다).",
    "휴대폰 설정에서 MacroDroid의 배터리 최적화를 끕니다.",
    "결제 후 홈에 거래가 나타나는지 확인합니다.",
  ],
};

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
