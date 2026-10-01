import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/hash";

export type TokenOwner = { userId: string; groupId: string };

/** 토큰 주인과 그룹을 찾는다. 없음·폐기·그룹 미소속이면 null. */
export async function resolveIngestToken(
  db: SupabaseClient,
  token: string,
  now: Date,
): Promise<TokenOwner | null> {
  const { data: row, error } = await db
    .from("ingest_tokens")
    .select("id, user_id")
    .eq("token_hash", sha256Hex(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: member, error: memberError } = await db
    .from("group_members")
    .select("group_id")
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) return null;

  const { error: touchError } = await db
    .from("ingest_tokens")
    .update({ last_used_at: now.toISOString() })
    .eq("id", row.id);
  if (touchError) throw touchError;

  return { userId: row.user_id, groupId: member.group_id };
}
