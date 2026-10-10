import type { SupabaseClient } from "@supabase/supabase-js";
import { FX_URL, kstDateKey, krwPerUnit, parseErApi } from "./rates";

type Fetch = typeof fetch;

/** 오늘 환율을 받아 날짜별로 저장(같은 날은 덮어씀). 실패하면 저장하지 않고 false */
export async function fetchAndStoreRates(db: SupabaseClient, fetchFn: Fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(FX_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    const parsed = parseErApi(await res.json());
    if (!parsed) return false;
    const { error } = await db.from("fx_rates").upsert({ date: parsed.date, base: "KRW", rates: parsed.rates, fetched_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}

async function nearest(db: SupabaseClient, day: string) {
  const before = await db.from("fx_rates").select("date, rates").lte("date", day).order("date", { ascending: false }).limit(1);
  if (before.data?.length) return before.data[0];
  const after = await db.from("fx_rates").select("date, rates").gt("date", day).order("date").limit(1);
  return after.data?.[0] ?? null;
}

/** 결제 날짜(KST)의 1단위 원화. 그날 이전 → 이후 → 표가 비면 한 번 받아 다시 */
export async function rateFor(db: SupabaseClient, currency: string, at: Date, fetchFn: Fetch = fetch) {
  const day = kstDateKey(at);
  let row = await nearest(db, day);
  if (!row && (await fetchAndStoreRates(db, fetchFn))) row = await nearest(db, day);
  if (!row) return null;
  const krwPer = krwPerUnit(row.rates as Record<string, number>, currency);
  return krwPer ? { krwPer, date: row.date as string } : null;
}

export async function latestRateDate(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("fx_rates").select("date").order("date", { ascending: false }).limit(1);
  return data?.[0]?.date ?? null;
}
