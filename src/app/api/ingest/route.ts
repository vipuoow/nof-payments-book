import { handleIngest } from "@/ingest/handler";
import { createRateLimiter } from "@/ingest/rate-limit";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const ipLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export async function POST(req: Request): Promise<Response> {
  return handleIngest(req, { db: createAdminClient(), tokenLimiter, ipLimiter, now: () => new Date() });
}
