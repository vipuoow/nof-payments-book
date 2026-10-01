/** 로그인 없이 열 수 있는 화면 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/auth/")
  );
}

/** 로그인 후 이동할 경로: 같은 사이트의 절대 경로만 허용한다(//host, /\host, 외부 URL 차단). */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
