const DAY = 24 * 3600_000;
const KST = 9 * 3600_000;
const RUN_AT = (9 * 60 + 10) * 60_000; // 09:10

export function msUntilNextRun(now: Date): number {
  const sinceMidnight = (now.getTime() + KST) % DAY;
  const wait = (RUN_AT - sinceMidnight + DAY) % DAY;
  return wait === 0 ? DAY : wait;
}

/** 앱이 켜질 때 한 번, 그 뒤 매일 09:10 KST. 실패는 기록만 하고 다음 날 다시 받는다 */
export function startFxSchedule(): void {
  const run = async () => {
    const { createAdminClient } = await import("@/lib/supabase-admin");
    const { fetchAndStoreRates } = await import("./store");
    const ok = await fetchAndStoreRates(createAdminClient()).catch(() => false);
    if (!ok) console.warn("[fx] 환율 받기 실패");
  };
  const loop = () => setTimeout(() => { void run().finally(loop); }, msUntilNextRun(new Date()));
  void run();
  loop();
}
