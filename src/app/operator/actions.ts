"use server";

import { revalidatePath } from "next/cache";
import { createServiceInvite } from "@/auth/groups";
import { kstMonthDay } from "@/auth/invite-text";
import { errorMessage } from "@/auth/messages";
import { operatorDeleteAccount, operatorDeleteGroup } from "@/auth/operator";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type ServiceInviteState = { url: string; text: string; until: string } | { error: string } | null;

/** 서비스 초대 링크(그룹장이 될 사람). 링크는 이때만 알 수 있다 */
export async function createServiceInviteAction(): Promise<ServiceInviteState> {
  const supabase = await createSupabaseServerClient();
  const result = await createServiceInvite(supabase);
  if (!result.ok) return { error: errorMessage(result.reason) };
  const url = `${process.env.APP_URL}/invite/${result.value.token}`;
  const until = kstMonthDay(result.value.expiresAt);
  return { url, until, text: `같이가계부에 초대해요. 아래 링크로 가입하면 가계부를 만들 수 있어요(${until}까지).\n${url}` };
}

export type OpState = { error?: string } | null;

/** 그룹 없애기: 그룹장 닉네임 확인 */
export async function deleteGroupAction(groupId: string, _prev: OpState, formData: FormData): Promise<OpState> {
  const supabase = await createSupabaseServerClient();
  const result = await operatorDeleteGroup(supabase, groupId, String(formData.get("confirm") ?? ""));
  if (!result.ok) return { error: errorMessage(result.reason) };
  revalidatePath("/operator");
  return null;
}

/** 가계부 없는 계정 지우기(계정·휴대폰 연결까지) */
export async function deleteAccountAction(userId: string): Promise<OpState> {
  const supabase = await createSupabaseServerClient();
  const result = await operatorDeleteAccount(supabase, createAdminClient(), userId);
  if (!result.ok) return { error: errorMessage(result.reason) };
  revalidatePath("/operator");
  return null;
}
