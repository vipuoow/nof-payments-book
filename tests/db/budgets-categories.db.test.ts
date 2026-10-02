import { describe, expect, it } from "vitest";
import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture, type GroupFixture } from "../helpers/db";

const db = adminClient();

async function defaultId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

describe("budgets", () => {
  it("0(이 달부터 없음)을 저장할 수 있고, 같은 달·카테고리는 upsert로 한 줄만 남는다", async () => {
    const g = await createGroupFixture("bud");
    const c = g.owner.client;
    const row = (amount: number) => ({ group_id: g.groupId, category_id: null, month: "2026-10-01", amount });
    expect((await c.from("budgets").upsert(row(300000), { onConflict: "group_id,category_id,month" })).error).toBeNull();
    expect((await c.from("budgets").upsert(row(0), { onConflict: "group_id,category_id,month" })).error).toBeNull();
    const { data } = await db.from("budgets").select("amount").eq("group_id", g.groupId);
    expect(data).toEqual([{ amount: 0 }]);
  });

  it("음수는 막고, 다른 그룹 예산은 쓸 수 없다", async () => {
    const g = await createGroupFixture("bud-neg");
    const other = await createGroupFixture("bud-other");
    const neg = await g.owner.client.from("budgets").insert({ group_id: g.groupId, month: "2026-10-01", amount: -1 });
    expect(neg.error).not.toBeNull();
    const foreign = await other.owner.client.from("budgets").insert({ group_id: g.groupId, month: "2026-10-01", amount: 1 });
    expect(foreign.error).not.toBeNull();
  });
});

describe("category_hidden", () => {
  it("기본 카테고리만 숨길 수 있고, 다른 그룹에서는 보이지도 쓰지도 못한다", async () => {
    const g = await createGroupFixture("hide");
    const other = await createGroupFixture("hide-other");
    const culture = await defaultId("문화");
    const { data: mine } = await db.from("categories").insert({ group_id: g.groupId, name: "반려동물", sort_order: 10 }).select("id").single();

    expect((await g.owner.client.from("category_hidden").insert({ group_id: g.groupId, category_id: culture })).error).toBeNull();
    expect((await g.owner.client.from("category_hidden").insert({ group_id: g.groupId, category_id: mine!.id })).error).not.toBeNull();
    expect((await other.owner.client.from("category_hidden").insert({ group_id: g.groupId, category_id: culture })).error).not.toBeNull();

    const { data: seenByOther } = await other.owner.client.from("category_hidden").select("category_id");
    expect(seenByOther).toEqual([]);
    const { data: seenByMember } = await g.member.client.from("category_hidden").select("category_id");
    expect(seenByMember).toEqual([{ category_id: culture }]);

    expect((await g.member.client.from("category_hidden").delete().eq("category_id", culture)).error).toBeNull();
    const { data: after } = await db.from("category_hidden").select("category_id").eq("group_id", g.groupId);
    expect(after).toEqual([]);
  });
});

describe("그룹 카테고리 이름", () => {
  it("같은 그룹 안에서 같은 이름은 막는다(다른 그룹은 허용)", async () => {
    const g = await createGroupFixture("cat-name");
    const other = await createGroupFixture("cat-name-other");
    expect((await g.owner.client.from("categories").insert({ group_id: g.groupId, name: "육아", sort_order: 10 })).error).toBeNull();
    const dup = await g.owner.client.from("categories").insert({ group_id: g.groupId, name: "육아", sort_order: 11 });
    expect(dup.error?.code).toBe("23505");
    expect((await other.owner.client.from("categories").insert({ group_id: other.groupId, name: "육아", sort_order: 10 })).error).toBeNull();
  });
});

describe("먼저 온 취소의 카테고리", () => {
  it("취소가 미지정이고 결제가 규칙으로 정해지면 취소도 같은 카테고리가 된다", async () => {
    const cafe = await defaultId("카페");
    const g: GroupFixture = await createGroupFixture("early-cat");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    const recv = new Date("2026-09-23T08:40:00+09:00");
    const cancel = await ingestMessage(db, owner, { body: CANCEL, receivedAt: recv, source: "manual_test" });
    await db.from("merchant_rules").insert({ group_id: g.groupId, merchant_pattern: "테스트커피 강남역점(메가", category_id: cafe });
    const approval = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: recv, source: "manual_test" });

    const { data } = await db.from("transactions")
      .select("id, category_id, category_source, cancels_transaction_id")
      .in("id", [cancel.transactionId!, approval.transactionId!]);
    const byId = new Map(data!.map((r) => [r.id, r]));
    expect(byId.get(approval.transactionId!)).toMatchObject({ category_id: cafe, category_source: "rule" });
    expect(byId.get(cancel.transactionId!)).toMatchObject({
      category_id: cafe, category_source: "rule", cancels_transaction_id: approval.transactionId,
    });
  });
});
