export const FX_URL = "https://open.er-api.com/v6/latest/KRW";
export const FX_SOURCE = "환율 제공: ExchangeRate-API";

export function kstDateKey(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function parseErApi(json: unknown): { date: string; rates: Record<string, number> } | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;
  if (j.result !== "success" || j.base_code !== "KRW" || typeof j.time_last_update_unix !== "number") return null;
  if (typeof j.rates !== "object" || j.rates === null) return null;
  const rates = j.rates as Record<string, unknown>;
  if (!Object.values(rates).every((v) => typeof v === "number" && v > 0)) return null;
  return { date: kstDateKey(new Date(j.time_last_update_unix * 1000)), rates: rates as Record<string, number> };
}

export function krwPerUnit(rates: Record<string, number>, currency: string): number | null {
  const r = rates[currency];
  return r ? Math.round((1 / r) * 10000) / 10000 : null;
}

export const toKrw = (foreignAmount: number, krwPer: number) => Math.round(foreignAmount * krwPer);

/** 외화 표기: 정수면 쉼표 정수(150,000 VND), 아니면 소수 둘째 자리(8.50 USD) */
export function fxLabel(f: { currency: string; foreignAmount: number }): string {
  const digits = Number.isInteger(f.foreignAmount) ? 0 : 2;
  return `${f.foreignAmount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${f.currency}`;
}

/** 미리 채운 원화의 계산 근거: "8 USD × 1,342.28원 (10월 2일 환율)로 계산했어요" */
export function fxNote(f: { currency: string; foreignAmount: number }, krwPer: number, date: string): string {
  const [, m, d] = date.split("-").map(Number);
  const rate = krwPer.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return `${fxLabel(f)} × ${rate}원 (${m}월 ${d}일 환율)로 계산했어요`;
}
