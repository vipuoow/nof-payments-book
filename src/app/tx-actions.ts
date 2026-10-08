"use server";

import { revalidatePath } from "next/cache";
import { kstMonthOf, monthParam } from "@/ledger/month";
import {
  createManualTx, deleteManualTx, editTx, FAIL, ignoreRaw, setOnnuri,
  type EditResult, type NewTx, type TxPatch,
} from "@/ledger/tx-edit";
import { loadMe } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * values: React 19는 액션이 끝나면 폼을 초기화하므로, 실패하면 입력값을 돌려줘 폼이 다시 채우게 한다.
 */
export type ActionState = { error?: string; values?: Record<string, string> } | null;

// 홈의 겹쳐 뜨는 화면(상세·새로 추가·확인할 문자)이 부른다. 이동하지 않고 결과만 돌려주면
// 화면이 움직임을 마친 뒤 router.refresh()로 새 값을 받는다.

export async function updateTxField(txId: string, patch: TxPatch): Promise<EditResult> {
  const r = await editTx(await createSupabaseServerClient(), txId, patch);
  if (r.ok) revalidatePath("/");
  return r;
}

export async function setOnnuriPaid(txId: string, on: boolean): Promise<EditResult> {
  const r = await setOnnuri(await createSupabaseServerClient(), txId, on);
  if (r.ok) revalidatePath("/");
  return r;
}

export async function deleteTx(txId: string): Promise<EditResult> {
  const r = await deleteManualTx(await createSupabaseServerClient(), txId);
  if (r.ok) revalidatePath("/");
  return r;
}

/** 저장한 거래의 id와 그 달(`YYYY-MM`). 화면은 그 달로 옮겨 가 새 줄로 빨려 들어간다. */
export async function createTx(input: NewTx): Promise<{ ok: true; id: string; month: string } | { ok: false; error: string }> {
  const { supabase, me } = await loadMe();
  if (!me.groupId) return { ok: false, error: FAIL };
  const r = await createManualTx(supabase, me.groupId, input);
  if (!r.ok) return r;
  revalidatePath("/");
  return { ok: true, id: r.id, month: monthParam(kstMonthOf(r.occurredAt)) };
}

export async function ignoreRawMessage(rawId: string): Promise<EditResult> {
  const r = await ignoreRaw(await createSupabaseServerClient(), rawId);
  if (r.ok) revalidatePath("/");
  return r;
}
