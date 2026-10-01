import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { randomToken, sha256Hex } from "@/lib/hash";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "test-password-1234";

export type TestUser = { userId: string; client: SupabaseClient };
export type GroupFixture = { groupId: string; owner: TestUser; member: TestUser };

export function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

export async function createLoneUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `${label}-${randomUUID()}@test.local`;
  const created = await must(
    admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }),
  );
  const userId = created.user!.id;
  await must(admin.from("profiles").insert({ user_id: userId, display_name: label }));

  const client = anonClient();
  await must(client.auth.signInWithPassword({ email, password: PASSWORD }));
  return { userId, client };
}

export async function createGroupFixture(label: string): Promise<GroupFixture> {
  const admin = adminClient();
  const owner = await createLoneUser(`${label}-owner`);
  const member = await createLoneUser(`${label}-member`);
  const group = await must(
    admin.from("groups").insert({ name: `${label} 가계부`, owner_id: owner.userId }).select("id").single(),
  );
  await must(
    admin.from("group_members").insert([
      { group_id: group.id, user_id: owner.userId, role: "owner" },
      { group_id: group.id, user_id: member.userId, role: "member" },
    ]),
  );
  return { groupId: group.id, owner, member };
}

export async function issueIngestToken(userId: string): Promise<string> {
  const token = randomToken();
  await must(
    adminClient().from("ingest_tokens").insert({ user_id: userId, token_hash: sha256Hex(token), label: "test" }),
  );
  return token;
}
