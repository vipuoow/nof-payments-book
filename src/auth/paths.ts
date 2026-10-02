/** 로그인 없이 열 수 있는 화면 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/auth/") ||
    // 홈 화면에 추가할 때 브라우저가 쿠키 없이 받을 수 있다
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-icon"
  );
}

/** 로그인 후 이동할 경로: 같은 사이트의 절대 경로만 허용한다(//host, /\host, 외부 URL 차단). */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  // 브라우저는 URL의 탭·줄바꿈을 지우므로 "/\t/evil.com"이 //evil.com이 된다
  if (/[\x00-\x1f]/.test(next)) return "/";
  return next;
}
