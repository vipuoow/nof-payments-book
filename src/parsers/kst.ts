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
