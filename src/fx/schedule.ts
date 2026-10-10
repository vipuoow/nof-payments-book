const DAY = 24 * 3600_000;
const KST = 9 * 3600_000;
const RUN_AT = (9 * 60 + 10) * 60_000; // 09:10

export function msUntilNextRun(now: Date): number {
  const sinceMidnight = (now.getTime() + KST) % DAY;
  const wait = (RUN_AT - sinceMidnight + DAY) % DAY;
  return wait === 0 ? DAY : wait;
}

/** 운영 앱에서 쓰는 받기: 서비스 키 클라이언트로 받아 저장 */
async function fetchWithAdmin(): Promise<boolean> {
  const { createAdminClient } = await import("@/lib/supabase-admin");
  const { fetchAndStoreRates } = await import("./store");
  return fetchAndStoreRates(createAdminClient());
}

const g = globalThis as { __fxScheduleStarted?: boolean };

/**
 * 앱이 켜질 때 한 번, 그 뒤 매일 09:10 KST. 실패는 기록만 하고 다음 날 다시 받는다.
 * 같은 서버에서 다시 불려도(개발 중 다시 불러오기) 타이머는 하나만 건다. 걸었으면 true.
 */
export function startFxSchedule(fetchRates: () => Promise<boolean> = fetchWithAdmin): boolean {
  if (g.__fxScheduleStarted) return false;
  g.__fxScheduleStarted = true;
  const run = async () => {
    try {
      if (!(await fetchRates())) console.warn("[fx] 환율 받기 실패");
    } catch (e) {
      console.warn("[fx] 환율 받기 실패", e instanceof Error ? e.message : e);
    }
  };
  const loop = () => setTimeout(() => { void run().then(loop); }, msUntilNextRun(new Date()));
  void run();
  loop();
  return true;
}
