/** 초대 수락 화면의 이름 기본값: Google 프로필 이름, 없으면 이메일 앞부분 */
export function defaultDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email?.split("@")[0] ?? "";
}
