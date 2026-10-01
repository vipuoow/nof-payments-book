import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/hash";
import { parseSms, type ParseResult } from "@/parsers";
import type { TokenOwner } from "./auth";
import { maskBody } from "./mask";

export type IngestSource = "ios_shortcut" | "android_macrodroid" | "manual_test";
export type IngestStatus = "parsed" | "unparsed" | "ignored" | "duplicate";
export type IngestResult = { status: IngestStatus; transactionId?: string };

type Payment = Extract<ParseResult, { kind: "approval" | "cancel" }>;

const UNIQUE_VIOLATION = "23505";

export async function ingestMessage(
  db: SupabaseClient,
  owner: TokenOwner,
  input: { body: string; receivedAt: Date; source: IngestSource },
): Promise<IngestResult> {
  const { parserId, result } = parseSms(input.body, input.receivedAt);
  const status =
    result.kind === "approval" || result.kind === "cancel" ? "parsed"
    : result.kind === "ignore" ? "ignored"
    : "unparsed";

  const { data: raw, error } = await db
    .from("raw_messages")
    .insert({
      group_id: owner.groupId,
      user_id: owner.userId,
      body: maskBody(input.body),
      body_hash: sha256Hex(input.body),
      source: input.source,
      received_at: input.receivedAt.toISOString(),
      status,
      parser_id: parserId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: "duplicate" };
    throw error;
  }

  if (result.kind !== "approval" && result.kind !== "cancel") return { status };

  try {
    const transactionId = await createTransaction(db, owner, raw.id, result);
    return { status, transactionId };
  } catch (e) {
    // 거래 저장에 실패하면 미분류로 돌려 화면에서 다시 처리할 수 있게 한다.
    await db.from("raw_messages").update({ status: "unparsed" }).eq("id", raw.id);
    throw e;
  }
}

async function createTransaction(
  db: SupabaseClient,
  owner: TokenOwner,
  rawMessageId: string,
  payment: Payment,
): Promise<string> {
  const categoryId = await findCategory(db, owner.groupId, payment.merchant);
  const cancelsId = payment.kind === "cancel" ? await findCancelTarget(db, owner, payment) : null;

  const { data, error } = await db
    .from("transactions")
    .insert({
      group_id: owner.groupId,
      user_id: owner.userId,
      raw_message_id: rawMessageId,
      kind: payment.kind,
      amount: payment.kind === "cancel" ? -payment.amount : payment.amount,
      merchant: payment.merchant,
      occurred_at: payment.occurredAt.toISOString(),
      issuer: payment.issuer,
      category_id: categoryId,
      cancels_transaction_id: cancelsId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function findCategory(db: SupabaseClient, groupId: string, merchant: string): Promise<string | null> {
  const { data, error } = await db
    .from("merchant_rules")
    .select("category_id")
    .eq("group_id", groupId)
    .eq("merchant_pattern", merchant)
    .maybeSingle();
  if (error) throw error;
  return data?.category_id ?? null;
}

async function findCancelTarget(db: SupabaseClient, owner: TokenOwner, payment: Payment): Promise<string | null> {
  const { data, error } = await db.rpc("find_cancel_target", {
    p_group: owner.groupId,
    p_user: owner.userId,
    p_amount: payment.amount,
    p_merchant: payment.merchant,
    p_at: payment.occurredAt.toISOString(),
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}
