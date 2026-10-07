import type { SupabaseClient } from "@supabase/supabase-js";
import { callRpc, type Result } from "./result";
import { newSecret } from "./tokens";

/** 가계부(그룹)를 만들면서 내 닉네임을 저장한다. */
export async function createGroup(db: SupabaseClient, displayName: string): Promise<Result<string>> {
  return callRpc(db.rpc("create_group", { p_display_name: displayName }), (d) => d as string);
}

/** 파트너 초대 링크: 가족 닉네임을 함께 저장하고, 쓰지 않은 이전 링크는 DB가 취소한다. */
export async function createGroupInvite(
  db: SupabaseClient,
  inviteeName: string,
): Promise<Result<{ token: string; expiresAt: string }>> {
  const { token, hash } = newSecret();
  return callRpc(
    db.rpc("create_group_invite", { p_token_hash: hash, p_invitee_name: inviteeName }),
    (d) => ({ token, expiresAt: d as string }),
  );
}

export async function revokeGroupInvite(db: SupabaseClient, inviteId: string): Promise<Result<null>> {
  return callRpc(db.rpc("revoke_group_invite", { p_invite_id: inviteId }), () => null);
}

export async function createServiceInvite(db: SupabaseClient): Promise<Result<{ token: string; expiresAt: string }>> {
  const { token, hash } = newSecret();
  return callRpc(db.rpc("create_service_invite", { p_token_hash: hash }), (d) => ({ token, expiresAt: d as string }));
}

export async function issueIngestToken(db: SupabaseClient, label: string): Promise<Result<{ token: string; id: string }>> {
  const { token, hash } = newSecret();
  return callRpc(db.rpc("issue_ingest_token", { p_token_hash: hash, p_label: label }), (d) => ({ token, id: d as string }));
}

export async function revokeIngestToken(db: SupabaseClient, tokenId: string): Promise<Result<null>> {
  return callRpc(db.rpc("revoke_ingest_token", { p_token_id: tokenId }), () => null);
}
