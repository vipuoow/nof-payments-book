/** 서버가 켜질 때 한 번 불린다(Next.js). Node 서버에서만 환율 타이머를 건다. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.FX_SCHEDULE === "off") return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { startFxSchedule } = await import("./fx/schedule");
  startFxSchedule();
}
