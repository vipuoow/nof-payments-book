import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

describe("초기 스키마", () => {
  it("설정값이 스펙의 기본값으로 들어 있다", async () => {
    const { data, error } = await admin.from("app_settings").select("key, value");
    expect(error).toBeNull();
    const settings = Object.fromEntries(data!.map((r) => [r.key, r.value]));
    expect(settings).toEqual({
      max_group_members: 2,
      max_users: 30,
      invite_ttl_days: 7,
      raw_message_retention_days: 365,
      budget_warning_ratio: 0.8,
    });
  });

  it("기본 카테고리(group_id null)가 들어 있다", async () => {
    const { data, error } = await admin
      .from("categories")
      .select("name")
      .is("group_id", null)
      .order("sort_order");
    expect(error).toBeNull();
    expect(data!.map((c) => c.name)).toEqual([
      "식비", "카페", "편의점", "교통", "쇼핑", "생활", "의료", "문화", "기타",
    ]);
  });
});
