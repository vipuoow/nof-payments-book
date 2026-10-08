/** 화면 모드(사람마다). profiles.theme에 저장하고 쿠키로 <html data-theme>에 적용한다. */
export const THEMES = ["basic", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "theme";
/** 쿠키는 1년. 로그인할 때와 모드를 바꿀 때 프로필 값으로 맞춘다 */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function themeOf(value: string | undefined | null): Theme {
  return (THEMES as readonly string[]).includes(value ?? "") ? (value as Theme) : "basic";
}

/** 휴대폰 위쪽(상태 표시줄) 띠 색: 그 모드 배경의 맨 위 색 */
export function barColorOf(theme: Theme): string {
  return theme === "dark" ? "#101013" : theme === "light" ? "#f2f4f6" : "#fcfbff";
}
