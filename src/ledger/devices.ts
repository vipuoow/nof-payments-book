export type Device = "iphone" | "android";

export const DEVICE_LABEL: Record<Device, string> = { iphone: "아이폰", android: "갤럭시" };

/** 기종별 설정 안내. 메뉴 이름은 OS·앱 버전에 따라 조금 다를 수 있다. */
export const DEVICE_STEPS: Record<Device, string[]> = {
  iphone: [
    "아래 [연결 코드 만들기]를 누른 뒤 연결 코드를 [복사]합니다.",
    "[단축어 받기]를 누르고, 단축어 앱이 열리면 [단축어 추가]를 누릅니다.",
    "단축어 앱의 '가계부로 보내기' 오른쪽 위 [⋯]을 누릅니다. 맨 위 '여기에연결코드붙여넣기' 글자를 눌러 모두 지우고, 복사한 연결 코드를 붙여넣은 뒤 [완료]를 누릅니다.",
    "시험: '가계부로 보내기'를 한 번 눌러 실행합니다. 이 화면을 새로고침해 '마지막 수신'이 방금 시각이면 연결된 것입니다.",
    "단축어 앱 아래 [자동화] → 오른쪽 위 [+] → [메시지]를 누릅니다.",
    "[메시지에 다음이 포함됨]에 KB국민카드를 넣고 [즉시 실행]을 고른 뒤 [다음]을 누릅니다.",
    "목록에서 '가계부로 보내기'를 고르면 끝입니다. 다음 결제부터 홈에 거래가 나타납니다.",
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
