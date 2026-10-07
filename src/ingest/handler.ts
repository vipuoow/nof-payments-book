import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { categorizeTransaction } from "@/categorize/categorize";
import type { CategoryClassifier } from "@/categorize/typesafe";
import { resolveIngestToken } from "./auth";
import type { RateLimiter } from "./rate-limit";
import { ingestMessage } from "./service";

/** 본문이 빈 요청은 연결 확인(단축어를 손으로 실행했을 때). 토큰 확인으로 마지막 수신 시각만 갱신된다. */
const PingBody = z.object({ body: z.string().trim().max(0) });

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
  /** 카테고리 자동 분류기. 없으면(키 미설정) 분류하지 않는다. */
  classify?: CategoryClassifier | null;
  /** 응답을 보낸 뒤 실행할 작업을 예약한다(라우트에서는 Next.js after). */
  afterResponse?: (task: () => Promise<void>) => void;
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
  if (PingBody.safeParse(payload).success) return json(200, { status: "connected" });
  const parsed = RequestBody.safeParse(payload);
  if (!parsed.success) return json(400, { error: "invalid_body" });

  const { body, receivedAt, source } = parsed.data;
  const result = await ingestMessage(deps.db, owner, {
    body,
    receivedAt: receivedAt ? new Date(receivedAt) : deps.now(),
    source,
  });

  const { classify, afterResponse } = deps;
  const transactionId = result.transactionId;
  if (transactionId && classify && afterResponse) {
    afterResponse(async () => {
      try {
        await categorizeTransaction(deps.db, classify, transactionId);
      } catch (e) {
        console.warn(`[categorize] 거래 ${transactionId} 분류 실패: ${(e as Error).message}`);
      }
    });
  }
  return json(200, result);
}
