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
