import { handleIngest } from "@/ingest/handler";
import { createRateLimiter } from "@/ingest/rate-limit";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(req: Request): Promise<Response> {
  return handleIngest(req, { db: createAdminClient(), limiter, now: () => new Date() });
}
