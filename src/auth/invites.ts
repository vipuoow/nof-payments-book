import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/hash";
import { callRpc, type Result } from "./result";

export type InviteKind = "service" | "group";
export type InviteStatus =
  | { status: "valid"; kind: InviteKind; inviterName: string | null; inviteeName: string | null }
  | { status: "invalid" | "used" | "expired" | "revoked" | "service_full" | "group_full" };

export async function getInviteStatus(admin: SupabaseClient, token: string): Promise<InviteStatus> {
  const { data, error } = await admin.rpc("invite_status", { p_token_hash: sha256Hex(token) });
  if (error) throw error;
  const row = data as { status: InviteStatus["status"]; kind?: InviteKind; inviter_name?: string | null; invitee_name?: string | null };
  if (row.status === "valid") {
    return { status: "valid", kind: row.kind!, inviterName: row.inviter_name ?? null, inviteeName: row.invitee_name ?? null };
  }
  return { status: row.status };
}

/** 초대 상태 → 화면 오류 코드 */
export function inviteStatusError(status: Exclude<InviteStatus["status"], "valid">): string {
  return status === "service_full" || status === "group_full" ? status : `invite_${status}`;
}

/**
 * 로그인한 사용자가 초대를 수락한다. fallbackName(보통 Google 이름)은 서비스 초대와
 * 닉네임 없이 만든 예전 그룹 초대에만 쓰인다. 그룹 초대는 그룹장이 정한 닉네임이 우선이다.
 */
export async function acceptInvite(
  userDb: SupabaseClient,
  token: string,
  fallbackName: string,
): Promise<Result<{ kind: InviteKind; groupId: string | null }>> {
  return callRpc(
    userDb.rpc("accept_invite", { p_token_hash: sha256Hex(token), p_display_name: fallbackName }),
    (data) => {
      const row = data as { kind: InviteKind; group_id: string | null };
      return { kind: row.kind, groupId: row.group_id };
    },
  );
}
