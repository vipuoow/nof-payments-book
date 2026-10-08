import type { SupabaseClient } from "@supabase/supabase-js";
import { callRpc, type Result } from "./result";

/** 이메일 계정을 (없으면 만들어) 운영자로 지정한다. 초대·인원 제한을 거치지 않는 유일한 가입 경로다. */
export async function grantOperator(admin: SupabaseClient, email: string, displayName: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const created = await admin.auth.admin.createUser({ email: normalized, email_confirm: true });
  let userId: string;
  if (created.error) {
    if (created.error.code !== "email_exists") throw created.error;
    userId = await findUserIdByEmail(admin, normalized);
  } else {
    userId = created.data.user.id;
  }

  const { error } = await admin
    .from("profiles")
    .upsert(
      { user_id: userId, display_name: displayName, is_operator: true, can_create_group: true },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  return userId;
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string> {
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user.id;
    if (data.users.length < perPage) throw new Error(`사용자를 찾을 수 없습니다: ${email}`);
  }
}

export type OverviewMember = { userId: string; name: string; role: "owner" | "member"; isOperator: boolean; connected: boolean };
export type OverviewGroup = { id: string; createdAt: string; txCount: number; lastMessageAt: string | null; members: OverviewMember[] };
export type Groupless = { userId: string; name: string; since: string; isOperator: boolean; connected: boolean };
export type Overview = { users: number; maxUsers: number; groups: OverviewGroup[]; groupless: Groupless[] };

/** 운영자 서비스 화면 현황. 운영자가 아니면 not_allowed 오류 */
export async function operatorOverview(db: SupabaseClient): Promise<Overview> {
  const { data, error } = await db.rpc("operator_overview");
  if (error) throw new Error(error.message);
  const row = data as {
    users: number; max_users: number;
    groups: { id: string; created_at: string; tx_count: number; last_message_at: string | null;
      members: { user_id: string; name: string; role: "owner" | "member"; is_operator: boolean; connected: boolean }[] | null }[];
    groupless: { user_id: string; name: string; since: string; is_operator: boolean; connected: boolean }[];
  };
  return {
    users: row.users,
    maxUsers: row.max_users,
    groups: row.groups.map((g) => ({
      id: g.id, createdAt: g.created_at, txCount: g.tx_count, lastMessageAt: g.last_message_at,
      members: (g.members ?? []).map((m) => ({ userId: m.user_id, name: m.name, role: m.role, isOperator: m.is_operator, connected: m.connected })),
    })),
    groupless: row.groupless.map((p) => ({ userId: p.user_id, name: p.name, since: p.since, isOperator: p.is_operator, connected: p.connected })),
  };
}

/** 그룹 없애기: 그룹 정보 삭제, 계정·휴대폰 연결은 남기고 가계부 만들기 권한은 거둔다. 그룹장 닉네임으로 확인 */
export async function operatorDeleteGroup(db: SupabaseClient, groupId: string, confirmName: string): Promise<Result<number>> {
  return callRpc(db.rpc("operator_delete_group", { p_group: groupId, p_confirm: confirmName }), (d) => d as number);
}

/** 가계부 없는 계정 지우기: 확인(운영자 권한·가계부 없음·운영자 아님) 뒤 Auth 계정을 지우면 프로필·휴대폰 연결이 함께 지워진다 */
export async function operatorDeleteAccount(db: SupabaseClient, admin: SupabaseClient, userId: string): Promise<Result<null>> {
  const checked = await callRpc(db.rpc("operator_prepare_delete_account", { p_user: userId }), () => null);
  if (!checked.ok) return checked;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, reason: "delete_failed" };
  return { ok: true, value: null };
}
