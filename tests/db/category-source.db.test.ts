import { describe, expect, it } from "vitest";
import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture } from "../helpers/db";

const db = adminClient();
const received = new Date("2026-09-23T08:40:00+09:00");
const MERCHANT = "테스트커피 강남역점(메가";

async function defaultCategoryId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function tx(id: string) {
  const { data, error } = await db.from("transactions").select("category_id, category_source").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("category_source", () => {
  it("설정값 category_ai_min_confidence는 0.7", async () => {
    const { data } = await db.from("app_settings").select("value").eq("key", "category_ai_min_confidence").single();
    expect(Number(data!.value)).toBe(0.7);
  });

  it("가맹점 규칙으로 정한 카테고리는 rule, 규칙이 없으면 비어 있다", async () => {
    const cafe = await defaultCategoryId("카페");
    const withRule = await createGroupFixture("src-rule");
    await db.from("merchant_rules").insert({ group_id: withRule.groupId, merchant_pattern: MERCHANT, category_id: cafe });
    const r1 = await ingestMessage(db, { userId: withRule.owner.userId, groupId: withRule.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    expect(await tx(r1.transactionId!)).toEqual({ category_id: cafe, category_source: "rule" });

    const noRule = await createGroupFixture("src-none");
    const r2 = await ingestMessage(db, { userId: noRule.owner.userId, groupId: noRule.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    expect(await tx(r2.transactionId!)).toEqual({ category_id: null, category_source: null });
  });

  it("자동 분류된 결제의 취소는 카테고리와 출처를 이어받는다", async () => {
    const cafe = await defaultCategoryId("카페");
    const g = await createGroupFixture("src-cancel");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    const appr = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source: "manual_test" });
    await db.from("transactions").update({ category_id: cafe, category_source: "ai" }).eq("id", appr.transactionId!);

    const cancel = await ingestMessage(db, owner, { body: CANCEL, receivedAt: received, source: "manual_test" });
    expect(await tx(cancel.transactionId!)).toEqual({ category_id: cafe, category_source: "ai" });
  });

  it("사용자가 카테고리를 바꾸면 user, 서버(service_role)가 바꾸면 그대로", async () => {
    const cafe = await defaultCategoryId("카페");
    const food = await defaultCategoryId("식비");
    const g = await createGroupFixture("src-user");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    const id = r.transactionId!;

    await db.from("transactions").update({ category_id: cafe, category_source: "ai" }).eq("id", id);
    expect(await tx(id)).toEqual({ category_id: cafe, category_source: "ai" });

    const { error } = await g.member.client.from("transactions").update({ category_id: food }).eq("id", id);
    expect(error).toBeNull();
    expect(await tx(id)).toEqual({ category_id: food, category_source: "user" });

    // 메모만 고치면 출처는 바뀌지 않는다
    await g.member.client.from("transactions").update({ memo: "점심" }).eq("id", id);
    expect(await tx(id)).toEqual({ category_id: food, category_source: "user" });

    // 미지정으로 되돌리면 출처도 비운다
    await g.member.client.from("transactions").update({ category_id: null }).eq("id", id);
    expect(await tx(id)).toEqual({ category_id: null, category_source: null });
  });

  it("카테고리를 지워 미지정이 되면 출처도 비운다", async () => {
    const g = await createGroupFixture("src-delete");
    const { data: cat } = await db.from("categories")
      .insert({ group_id: g.groupId, name: "반려동물", sort_order: 10 }).select("id").single();
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    await db.from("transactions").update({ category_id: cat!.id, category_source: "ai" }).eq("id", r.transactionId!);

    const { error } = await g.owner.client.from("categories").delete().eq("id", cat!.id);
    expect(error).toBeNull();
    expect(await tx(r.transactionId!)).toEqual({ category_id: null, category_source: null });
  });

  it("사용자는 category_source를 직접 쓸 수 없다", async () => {
    const g = await createGroupFixture("src-deny");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    const { error } = await g.owner.client.from("transactions").update({ category_source: "ai" }).eq("id", r.transactionId!);
    expect(error?.code).toBe("42501");
  });

  it("사용자가 수동 입력에 카테고리를 넣으면 user", async () => {
    const food = await defaultCategoryId("식비");
    const g = await createGroupFixture("src-manual");
    const { data, error } = await g.owner.client.from("transactions").insert({
      group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 5000,
      merchant: "시장", occurred_at: "2026-09-23T03:00:00Z", category_id: food,
    }).select("id").single();
    expect(error).toBeNull();
    expect(await tx(data!.id)).toEqual({ category_id: food, category_source: "user" });
  });
});
