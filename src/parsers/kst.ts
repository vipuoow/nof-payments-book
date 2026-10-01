const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 연·월 */
function kstYearMonth(d: Date): { year: number; month: number } {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1 };
}

/** KST 시각(월은 1부터)을 Date로 */
export function kstDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS);
}

/** 연도 없는 문자의 연도: 문자 월이 수신 월(KST)보다 크면 전년도 */
export function inferYear(messageMonth: number, receivedAt: Date): number {
  const { year, month } = kstYearMonth(receivedAt);
  return messageMonth > month ? year - 1 : year;
}

/** 실제로 있는 날짜·시각인지 (2월 30일, 13월, 24시 등은 거짓) */
export function isValidKstDateTime(year: number, month: number, day: number, hour: number, minute: number): boolean {
  if (hour > 23 || minute > 59) return false;
  const k = new Date(kstDate(year, month, day, hour, minute).getTime() + KST_OFFSET_MS);
  return k.getUTCMonth() + 1 === month && k.getUTCDate() === day;
}
