import { createClient } from "@supabase/supabase-js";
import { grantOperator } from "../src/auth/operator.ts";

const [email, name = "운영자"] = process.argv.slice(2);
if (!email) {
  console.error("사용법: pnpm operator:grant <이메일> [이름]");
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local)");
  process.exit(1);
}

const userId = await grantOperator(createClient(url, key, { auth: { persistSession: false } }), email, name);
console.log(`운영자 지정 완료: ${email} (${userId})`);
