import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** service_role 클라이언트. 서버 코드(라우트·서버 액션)에서만 import한다. */
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다");
  return createClient(url, key, { auth: { persistSession: false } });
}
