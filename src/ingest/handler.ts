import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveIngestToken } from "./auth";
import type { RateLimiter } from "./rate-limit";
import { ingestMessage } from "./service";

const RequestBody = z.object({
  body: z.string().trim().min(1).max(2000),
  receivedAt: z.iso.datetime({ offset: true }).optional(),
  source: z.enum(["ios_shortcut", "android_macrodroid", "manual_test"]),
});

export type IngestDeps = {
  db: SupabaseClient;
  /** 인증된 사용자별 제한 (스펙: 토큰당 분당 30회) */
  tokenLimiter: RateLimiter;
  /** 토큰 확인(DB 조회) 전에 거는 IP별 제한 */
  ipLimiter: RateLimiter;
  now: () => Date;
};

const json = (status: number, payload: unknown) => Response.json(payload, { status });

/** Cloudflare Tunnel 뒤에서는 cf-connecting-ip, 그 밖의 프록시는 x-forwarded-for 첫 값 */
function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function handleIngest(req: Request, deps: IngestDeps): Promise<Response> {
  if (!deps.ipLimiter(clientIp(req))) return json(429, { error: "rate_limited" });

  const token = /^Bearer\s+(\S+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return json(401, { error: "unauthorized" });

  const owner = await resolveIngestToken(deps.db, token, deps.now());
  if (!owner) return json(401, { error: "unauthorized" });
  if (!deps.tokenLimiter(owner.userId)) return json(429, { error: "rate_limited" });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const parsed = RequestBody.safeParse(payload);
  if (!parsed.success) return json(400, { error: "invalid_body" });

  const { body, receivedAt, source } = parsed.data;
  const result = await ingestMessage(deps.db, owner, {
    body,
    receivedAt: receivedAt ? new Date(receivedAt) : deps.now(),
    source,
  });
  return json(200, result);
}
