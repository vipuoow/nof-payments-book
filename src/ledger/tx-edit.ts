import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuid, parseAmount, parseMerchant, parseOccurredAt, parseTxForm } from "./forms";

/**
 * 거래 상세·새로 추가·밀어서 삭제·확인할 문자의 저장 규칙. 화면을 거치지 않은 호출도 여기서 막는다.
 * db는 로그인한 사람의 클라이언트(RLS로 내 그룹 것만 보인다).
 */
export type EditResult = { ok: true } | { ok: false; error: string };

export const FAIL = "저장하지 못했습니다. 다시 시도해 주세요.";
export const CARD_ONLY = "카드 문자로 들어온 거래는 분류만 고칠 수 있어요.";
export const CARD_NO_DELETE = "카드 문자로 들어온 거래는 지울 수 없어요.";
export const RAW_DONE = "이미 처리된 문자입니다.";

/** 한 번에 한 항목. 값은 화면 입력 그대로(금액 "13,325", 언제 "YYYY-MM-DDTHH:mm") */
export type TxPatch = { amount?: string; merchant?: string; occurredAt?: string; userId?: string; categoryId?: string | null };

const PATCH_KEYS = ["amount", "merchant", "occurredAt", "userId", "categoryId"];

/** 서버 함수는 아무 값으로나 불릴 수 있다: 항목 하나, 정해진 이름, 글자 값(분류는 null 허용)만 받는다 */
function validPatch(patch: unknown): patch is TxPatch {
  if (typeof patch !== "object" || patch === null) return false;
  const entries = Object.entries(patch);
  if (entries.length !== 1) return false;
  const [key, value] = entries[0];
  if (!PATCH_KEYS.includes(key)) return false;
  return typeof value === "string" || (key === "categoryId" && value === null);
}

export async function editTx(db: SupabaseClient, txId: string, patch: TxPatch, now: Date = new Date()): Promise<EditResult> {
  if (!isUuid(txId) || !validPatch(patch)) return { ok: false, error: FAIL };
  if ("categoryId" in patch) {
    if (patch.categoryId && !isUuid(patch.categoryId)) return { ok: false, error: FAIL };
    // 가게 규칙 학습·같은 달 같은 가게 일괄 적용은 DB 함수가 한다
    const { error } = await db.rpc("set_transaction_category", { p_transaction: txId, p_category: patch.categoryId || null });
    if (error) return { ok: false, error: FAIL };
    return { ok: true };
  }
  const update: Record<string, unknown> = {};
  if (patch.amount !== undefined) {
    const r = parseAmount(patch.amount);
    if (!r.ok) return r;
    update.amount = r.value;
  }
  if (patch.merchant !== undefined) {
    const r = parseMerchant(patch.merchant);
    if (!r.ok) return r;
    update.merchant = r.value;
  }
  if (patch.occurredAt !== undefined) {
    const r = parseOccurredAt(patch.occurredAt, now);
    if (!r.ok) return r;
    update.occurred_at = r.value.toISOString();
  }
  if (patch.userId !== undefined) {
    if (!isUuid(patch.userId)) return { ok: false, error: "사람을 골라 주세요." };
    update.user_id = patch.userId;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { data: current } = await db.from("transactions").select("kind").eq("id", txId).maybeSingle();
  if (!current) return { ok: false, error: FAIL };
  if (current.kind !== "manual") return { ok: false, error: CARD_ONLY };
  const { data, error } = await db.from("transactions").update(update).eq("id", txId).eq("kind", "manual").select("id");
  if (error || !data?.length) return { ok: false, error: FAIL };
  return { ok: true };
}

/** 온누리상품권 결제 표시(카드 대금 미청구, 쓴 돈에는 그대로) */
export async function setOnnuri(db: SupabaseClient, txId: string, on: boolean): Promise<EditResult> {
  if (!isUuid(txId) || typeof on !== "boolean") return { ok: false, error: FAIL };
  const { data, error } = await db.from("transactions").update({ paid_with: on ? "onnuri" : null }).eq("id", txId).select("id");
  // 없는 거래나 다른 그룹 거래는 바뀐 행이 0개다
  if (error || !data?.length) return { ok: false, error: FAIL };
  return { ok: true };
}

/** 직접 추가한 거래만 지운다 */
export async function deleteManualTx(db: SupabaseClient, txId: string): Promise<EditResult> {
  if (!isUuid(txId)) return { ok: false, error: FAIL };
  const { data: current } = await db.from("transactions").select("kind").eq("id", txId).maybeSingle();
  if (!current) return { ok: false, error: FAIL };
  if (current.kind !== "manual") return { ok: false, error: CARD_NO_DELETE };
  const { data, error } = await db.from("transactions").delete().eq("id", txId).eq("kind", "manual").select("id");
  if (error || !data?.length) return { ok: false, error: FAIL };
  return { ok: true };
}

export type NewTx = { amount: string; merchant: string; occurredAt: string; userId: string; categoryId: string | null; rawId?: string | null };

/** 새로 추가. 확인할 문자에서 왔으면(rawId) 저장 뒤 그 문자를 처리됨(parsed)으로 바꾼다 */
export async function createManualTx(
  db: SupabaseClient, groupId: string, input: NewTx, now: Date = new Date(),
): Promise<{ ok: true; id: string; occurredAt: Date } | { ok: false; error: string }> {
  if (typeof input !== "object" || input === null) return { ok: false, error: FAIL };
  const parsed = parseTxForm((name) => {
    const v = (input as Record<string, unknown>)[name];
    return typeof v === "string" ? v : "";
  }, now);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (v.categoryId !== null && !isUuid(v.categoryId)) return { ok: false, error: FAIL };
  const rawId = isUuid(input.rawId) ? input.rawId : null;
  // 문자를 먼저 차지한다(둘이 동시에 등록해도 한 사람만 성공). 거래 저장에 실패하면 되돌린다
  if (rawId) {
    const { data: claimed, error } = await db.from("raw_messages").update({ status: "parsed" })
      .eq("id", rawId).eq("status", "unparsed").select("id");
    if (error) return { ok: false, error: FAIL };
    if (!claimed.length) return { ok: false, error: RAW_DONE };
  }
  const { data, error } = await db.from("transactions").insert({
    group_id: groupId, user_id: v.userId, kind: "manual", amount: v.amount, merchant: v.merchant,
    occurred_at: v.occurredAt.toISOString(), category_id: v.categoryId, memo: "",
  }).select("id").single();
  if (error || !data) {
    if (rawId) {
      const { error: undo } = await db.from("raw_messages").update({ status: "unparsed" }).eq("id", rawId).eq("status", "parsed");
      if (undo) console.warn(`[unparsed] 문자 ${rawId} 되돌리기 실패: ${undo.message}`);
    }
    return { ok: false, error: FAIL };
  }
  return { ok: true, id: data.id, occurredAt: v.occurredAt };
}

export async function ignoreRaw(db: SupabaseClient, rawId: string): Promise<EditResult> {
  if (!isUuid(rawId)) return { ok: false, error: FAIL };
  const { data, error } = await db.from("raw_messages").update({ status: "ignored" })
    .eq("id", rawId).eq("status", "unparsed").select("id");
  if (error) return { ok: false, error: FAIL };
  if (data.length === 0) return { ok: false, error: RAW_DONE };
  return { ok: true };
}
