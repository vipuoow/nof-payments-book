import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingInvite = { name: string; expiresAt: string; expired: boolean };

/** 처음 홈 단계와 메뉴를 정하는 그룹 상태. 파트너의 기기 연결 여부는 RLS 밖이라 DB 함수로 요약만 받는다. */
export type Setup = {
  /** 그룹 구성원 중 누군가의 휴대폰에서 문자가 한 번이라도 도착했다 */
  anyConnected: boolean;
  /** 연결된 사람의 닉네임(나를 먼저). 아무도 없으면 null */
  connectedName: string | null;
  /** 내 휴대폰에서 문자가 한 번이라도 도착했다 */
  meConnected: boolean;
  /** 전체 한도를 한 번이라도 정했다 */
  hasTotalLimit: boolean;
  memberCount: number;
  /** 쓰지 않고 취소하지 않은 가장 최근 파트너 초대(만료 포함) */
  pendingInvite: PendingInvite | null;
};

export async function loadSetup(db: SupabaseClient): Promise<Setup> {
  const { data, error } = await db.rpc("group_setup_status");
  if (error) throw error;
  const row = data as {
    any_connected: boolean; connected_name: string | null; me_connected: boolean; has_total_limit: boolean; member_count: number;
    pending_invite: { name: string | null; expires_at: string; expired: boolean } | null;
  };
  const p = row.pending_invite;
  return {
    anyConnected: row.any_connected,
    connectedName: row.connected_name,
    meConnected: row.me_connected,
    hasTotalLimit: row.has_total_limit,
    memberCount: row.member_count,
    pendingInvite: p ? { name: p.name ?? "", expiresAt: new Date(p.expires_at).toISOString(), expired: p.expired } : null,
  };
}
