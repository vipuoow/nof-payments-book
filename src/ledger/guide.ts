import type { Device } from "./devices";

export type Cards = { kb: boolean; hyundai: boolean };
export type CopyKey = "code" | "kb" | "hyundai" | "url" | "header" | "body";
export type GuideStep = {
  id: string;
  title: string;
  body: string;
  copies?: { label: string; key: CopyKey }[];
  /** cards: 쓰는 카드 고르기, issue: 연결 코드 만들기, shortcut: 단축어 받기, store: 앱 설치, check: 연결 확인 */
  action?: "cards" | "issue" | "shortcut" | "store" | "check";
};

/** 접속한 휴대폰 기종(User-Agent). Android가 아니면 아이폰 안내를 먼저 보여 준다. */
export function detectDevice(userAgent: string | null): Device {
  return userAgent && /android/i.test(userAgent) ? "android" : "iphone";
}

const CARD_COPIES = (cards: Cards, android: boolean) => [
  ...(cards.kb ? [{ label: "KB국민카드", key: "kb" as const }] : []),
  ...(cards.hyundai ? [{ label: android ? "현대 (트리거를 하나 더)" : "현대 (자동화를 하나 더)", key: "hyundai" as const }] : []),
];

const CHECK: GuideStep = {
  id: "check",
  title: "연결을 확인해요",
  body: "",
  action: "check",
};

/** 화면으로 따라 하는 연결 안내(설계 4.8). 고른 카드에 맞는 글자만 복사하게 한다. */
export function guideSteps(device: Device, cards: Cards): GuideStep[] {
  if (device === "android") {
    return [
      { id: "cards", title: "갤럭시로 연결할게요", body: "카드 결제 문자가 오면 휴대폰이 가계부로 보내도록 설정해요. MacroDroid라는 무료 앱을 써요.", action: "cards" },
      { id: "install", title: "MacroDroid를 설치해요", body: "Play 스토어에서 MacroDroid를 설치하고 열어요. 처음 안내는 [건너뛰기]로 넘어가도 돼요.", action: "store" },
      { id: "trigger", title: "문자가 오면 실행되게 해요", body: "[매크로 추가] → 트리거 [SMS 수신] → 내용에 아래 글자가 포함될 때로 정해요. 고른 카드마다 트리거를 하나씩 더해요.", copies: CARD_COPIES(cards, true) },
      {
        id: "http", title: "가계부로 보내게 해요", action: "issue",
        body: "동작 [HTTP 요청]을 추가해요. 방법은 POST, 콘텐츠 유형은 application/json이에요. 아래 세 가지를 차례로 복사해 붙여넣어요.",
        copies: [{ label: "주소", key: "url" }, { label: "헤더 Authorization", key: "header" }, { label: "보낼 내용", key: "body" }],
      },
      { id: "battery", title: "배터리 절약을 꺼요", body: "설정 → 애플리케이션 → MacroDroid → 배터리 → [제한 없음]. 꺼 두지 않으면 문자를 놓칠 수 있어요." },
      { ...CHECK, body: "MacroDroid에서 만든 매크로를 한 번 실행해 보세요. 가계부에 도착하면 아래가 바뀌어요." },
    ];
  }
  return [
    { id: "cards", title: "아이폰으로 연결할게요", body: "카드 결제 문자가 오면 휴대폰이 가계부로 보내도록 설정해요. 5분이면 끝나요.", action: "cards" },
    { id: "code", title: "연결 코드를 복사해요", body: "이 코드가 내 휴대폰과 가계부를 이어 줘요. 다른 사람에게 보여 주지 마세요.", action: "issue", copies: [{ label: "연결 코드", key: "code" }] },
    { id: "shortcut", title: "단축어를 받아요", body: "버튼을 누르면 단축어 앱이 열려요. [단축어 추가]를 누르고 이 화면으로 돌아와 주세요.", action: "shortcut" },
    { id: "paste", title: "연결 코드를 붙여넣어요", body: "단축어 앱에서 ‘가계부로 보내기’ 오른쪽 위 [⋯]을 눌러요. 맨 위 ‘여기에연결코드붙여넣기’ 글자를 지우고 복사한 코드를 붙여넣은 뒤 [완료]를 눌러요.", copies: [{ label: "연결 코드", key: "code" }] },
    { id: "automation", title: "자동화를 만들어요", body: "단축어 앱 아래 [자동화] → 오른쪽 위 [+] → [메시지]를 눌러요." },
    { id: "keyword", title: "카드 문자를 고르세요", body: "[메시지에 다음이 포함됨]에 아래 글자를 붙여넣고, [즉시 실행]을 고른 뒤 ‘가계부로 보내기’를 골라요. 고른 카드마다 자동화를 하나씩 만들어요.", copies: CARD_COPIES(cards, false) },
    { ...CHECK, body: "단축어 앱에서 ‘가계부로 보내기’를 한 번 눌러 실행해 보세요. 가계부에 도착하면 아래가 바뀌어요." },
  ];
}
