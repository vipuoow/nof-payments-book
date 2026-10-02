/** 한국 시간(KST, UTC+9) 기준 월·날짜 계산. 한국은 서머타임이 없어 고정 오프셋을 쓴다. */
export type Month = { year: number; month: number };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const kst = (d: Date) => new Date(d.getTime() + KST_OFFSET_MS);

export function kstMonthOf(d: Date): Month {
  const k = kst(d);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1 };
}

export function compareMonth(a: Month, b: Month): number {
  return (a.year - b.year) * 12 + (a.month - b.month);
}

/** `?month=YYYY-MM`. 없거나 형식이 틀리거나 미래면 이번 달. */
export function parseMonthParam(value: string | string[] | undefined, now: Date): Month {
  const current = kstMonthOf(now);
  if (typeof value !== "string") return current;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return current;
  const parsed = { year: Number(m[1]), month: Number(m[2]) };
  if (parsed.month < 1 || parsed.month > 12 || compareMonth(parsed, current) > 0) return current;
  return parsed;
}

export function shiftMonth(m: Month, delta: number): Month {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export function monthParam(m: Month): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}`;
}

export function monthLabel(m: Month): string {
  return `${m.year}년 ${m.month}월`;
}

/** KST 그 달 1일 0시 ≤ t < 다음 달 1일 0시 */
export function monthRange(m: Month): { from: Date; to: Date } {
  const next = shiftMonth(m, 1);
  return {
    from: new Date(Date.UTC(m.year, m.month - 1, 1) - KST_OFFSET_MS),
    to: new Date(Date.UTC(next.year, next.month - 1, 1) - KST_OFFSET_MS),
  };
}

/** KST 날짜 키 "YYYY-MM-DD" */
export function kstDayKey(d: Date): string {
  return kst(d).toISOString().slice(0, 10);
}

/** "10월 1일 (목)" */
export function dayLabel(key: string): string {
  const [y, mo, da] = key.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, da)).getUTCDay()];
  return `${mo}월 ${da}일 (${weekday})`;
}

/** `<input type="datetime-local">` 값(KST) "YYYY-MM-DDTHH:mm" */
export function kstLocalValue(d: Date): string {
  return kst(d).toISOString().slice(0, 16);
}

export function parseKstLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MS);
  // 2월 30일처럼 넘어간 날짜는 되돌렸을 때 값이 달라진다
  return kstLocalValue(date) === value ? date : null;
}
