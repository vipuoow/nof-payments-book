import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";

export type Me = {
  userId: string;
  displayName: string;
  isOperator: boolean;
  canCreateGroup: boolean;
  groupId: string | null;
  groupName: string | null;
  role: "owner" | "member" | null;
};

/** 로그인 사용자와 프로필·그룹. 로그인하지 않았으면 /login, 초대 수락 전(프로필 없음)이면 로그아웃 경로로 보낸다. */
export async function loadMe(): Promise<{ supabase: SupabaseClient; me: Me }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_operator, can_create_group")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/auth/no-profile");

  const { data: member } = await supabase
    .from("group_members")
    .select("group_id, role, groups(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  const group = member?.groups as { name: string } | null | undefined;

  return {
    supabase,
    me: {
      userId: user.id,
      displayName: profile.display_name,
      isOperator: profile.is_operator,
      canCreateGroup: profile.can_create_group,
      groupId: member?.group_id ?? null,
      groupName: group?.name ?? null,
      role: (member?.role as Me["role"]) ?? null,
    },
  };
}
