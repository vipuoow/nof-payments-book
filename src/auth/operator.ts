import type { SupabaseClient } from "@supabase/supabase-js";

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
