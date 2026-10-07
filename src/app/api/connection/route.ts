import { NextResponse } from "next/server";
import { loadSetup } from "@/ledger/setup";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 연결 안내 마지막 단계가 몇 초마다 묻는다: 내 휴대폰에서 문자가 한 번이라도 도착했는지 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  try {
    const setup = await loadSetup(supabase);
    return NextResponse.json({ meConnected: setup.meConnected }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ meConnected: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
