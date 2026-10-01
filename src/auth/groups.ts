import type { SupabaseClient } from "@supabase/supabase-js";
import { callRpc, type Result } from "./result";
import { newSecret } from "./tokens";

export async function createGroup(db: SupabaseClient, name: string): Promise<Result<string>> {
  return callRpc(db.rpc("create_group", { p_name: name }), (d) => d as string);
}

export async function createGroupInvite(db: SupabaseClient): Promise<Result<{ token: string; expiresAt: string }>> {
  const { token, hash } = newSecret();
  return callRpc(db.rpc("create_group_invite", { p_token_hash: hash }), (d) => ({ token, expiresAt: d as string }));
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
