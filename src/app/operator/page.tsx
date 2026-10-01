import Link from "next/link";
import { redirect } from "next/navigation";
import { OneTimeSecretForm } from "@/components/one-time-secret-form";
import { loadMe } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServiceInviteAction } from "./actions";

export default async function OperatorPage() {
  const { me } = await loadMe();
  if (!me.isOperator) redirect("/");

  // 운영자 현황은 RLS 범위(자기 그룹)를 넘으므로 서버 전용 키로 센다. 운영자 확인 뒤에만 쓴다.
  const admin = createAdminClient();
  const [{ count: users }, { data: maxUsers }, { data: groups }] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("app_settings").select("value").eq("key", "max_users").single(),
    admin.from("groups").select("id, created_at, profiles(display_name), group_members(count)").order("created_at"),
  ]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href="/" className="text-sm underline">← 홈</Link>
      <h1 className="my-4 text-xl font-bold">운영자</h1>
      <p className="mb-4">사용자 {users ?? 0} / {String(maxUsers?.value ?? "-")}명</p>
      <OneTimeSecretForm action={createServiceInviteAction} buttonLabel="서비스 초대 링크 만들기" valueLabel="서비스 초대 링크" />
      <h2 className="mb-2 mt-6 font-semibold">그룹</h2>
      <ul className="list-disc pl-5 text-sm">
        {(groups ?? []).map((g) => (
          <li key={g.id}>
            {(g.profiles as unknown as { display_name: string } | null)?.display_name ?? "?"}님 그룹 ({(g.group_members as unknown as { count: number }[])[0]?.count ?? 0}명)
          </li>
        ))}
      </ul>
    </main>
  );
}
