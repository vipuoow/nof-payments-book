import { kstDayKey } from "./month";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "언제" 질문의 빠른 선택: 오늘·어제·그저께의 KST 날짜(YYYY-MM-DD) */
export function dayShortcuts(now: Date): { label: string; date: string }[] {
  return ["오늘", "어제", "그저께"].map((label, i) => ({ label, date: kstDayKey(new Date(now.getTime() - i * DAY_MS)) }));
}

/** "YYYY-MM-DDTHH:mm" ↔ 날짜·시각 */
export function splitLocal(value: string): { date: string; time: string } {
  return { date: value.slice(0, 10), time: value.slice(11, 16) };
}

export function joinLocal(date: string, time: string): string {
  return `${date}T${time}`;
}
