/**
 * 앱 안 브라우저(카카오톡으로 받은 초대 링크 등)를 알아챈다. 이런 브라우저에서는
 * 아이폰 단축어 추가가 동작하지 않고(버튼이 눌리지 않음) Google 로그인도 막힐 수 있어 Safari로 안내한다.
 */
export type InApp = "kakao" | "naver" | "instagram" | "facebook" | "line" | "band";

const APPS: { app: InApp; name: string; test: RegExp }[] = [
  { app: "kakao", name: "카카오톡", test: /KAKAOTALK/i },
  { app: "naver", name: "네이버", test: /NAVER\(inapp/i },
  { app: "instagram", name: "인스타그램", test: /Instagram/ },
  { app: "facebook", name: "페이스북", test: /FBAN|FBAV/ },
  { app: "line", name: "라인", test: /\bLine\// },
  { app: "band", name: "밴드", test: /\bBAND\// },
];

export function detectInApp(userAgent: string | null): { app: InApp; name: string } | null {
  if (!userAgent) return null;
  const hit = APPS.find((a) => a.test.test(userAgent));
  return hit ? { app: hit.app, name: hit.name } : null;
}

/** 버튼 하나로 외부 브라우저(Safari)로 넘기는 주소. 방법이 없는 앱은 null */
export function externalOpenUrl(app: InApp, url: string): string | null {
  if (app === "kakao") return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  if (app === "line") return `${url}${url.includes("?") ? "&" : "?"}openExternalBrowser=1`;
  return null;
}

/** 옮겨 갈 브라우저 이름: 아이폰은 Safari, 그 밖(갤럭시 등)은 기본 브라우저 */
export function outsideBrowser(userAgent: string | null): "Safari" | "기본 브라우저" {
  return userAgent && /iPhone|iPad|iPod/.test(userAgent) ? "Safari" : "기본 브라우저";
}

/** 바깥 브라우저로 넘길 절대 주소. APP_URL이 없으면 요청의 host·proto로 만들고, 그것도 없으면 null */
export function absoluteUrl(appUrl: string | undefined, host: string | null, proto: string | null, path: string): string | null {
  const base = appUrl?.replace(/\/+$/, "") || (host ? `${proto || "http"}://${host}` : "");
  return base ? `${base}${path}` : null;
}
