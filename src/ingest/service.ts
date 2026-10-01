import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/hash";
import { parseSms } from "@/parsers";
import { smsLines } from "@/parsers/lines";
import type { TokenOwner } from "./auth";
import { maskBody } from "./mask";

export type IngestSource = "ios_shortcut" | "android_macrodroid" | "manual_test";
export type IngestStatus = "parsed" | "unparsed" | "ignored" | "duplicate";
export type IngestResult = { status: IngestStatus; transactionId?: string };

/** 중복 판정용 해시: 형식 차이를 없애고 카드번호를 가린 뒤 해시한다. */
export function dedupeHash(body: string): string {
  return sha256Hex(maskBody(smsLines(body).join("\n")));
}

/**
 * 문자를 분석하고, 원문 저장·중복 판정·취소 연결·거래 생성은 DB 함수(ingest_sms)에서
 * 한 트랜잭션으로 처리한다.
 */
export async function ingestMessage(
  db: SupabaseClient,
  owner: TokenOwner,
  input: { body: string; receivedAt: Date; source: IngestSource },
): Promise<IngestResult> {
  const { parserId, result } = parseSms(input.body, input.receivedAt);
  const payment = result.kind === "approval" || result.kind === "cancel" ? result : null;
  const status = payment ? "parsed" : result.kind === "ignore" ? "ignored" : "unparsed";

  const { data, error } = await db.rpc("ingest_sms", {
    p_group: owner.groupId,
    p_user: owner.userId,
    p_body: maskBody(input.body),
    p_body_hash: dedupeHash(input.body),
    p_source: input.source,
    p_received_at: input.receivedAt.toISOString(),
    p_status: status,
    p_parser_id: parserId,
    p_kind: payment?.kind ?? null,
    p_amount: payment?.amount ?? null,
    p_merchant: payment?.merchant ?? null,
    p_occurred_at: payment?.occurredAt.toISOString() ?? null,
    p_issuer: payment?.issuer ?? null,
  });
  if (error) throw error;

  const row = data as { status: IngestStatus; transaction_id?: string };
  return row.transaction_id ? { status: row.status, transactionId: row.transaction_id } : { status: row.status };
}
