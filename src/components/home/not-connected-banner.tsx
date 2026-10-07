import Link from "next/link";

/** 내 휴대폰만 아직 연결 전일 때 홈 맨 위 알림 */
export function NotConnectedBanner() {
  return (
    <Link href="/devices" className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
      <span>내 휴대폰은 아직 연결 전이에요</span>
      <span className="shrink-0 font-normal">연결하기 ›</span>
    </Link>
  );
}
