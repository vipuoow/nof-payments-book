import { describe, expect, it, vi } from "vitest";
import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { categorizeTransaction } from "@/categorize/categorize";
import type { CategoryClassifier, CategoryOption } from "@/categorize/typesafe";
import { adminClient, createGroupFixture, type GroupFixture } from "../helpers/db";

const db = adminClient();
const received = new Date("2026-09-23T08:40:00+09:00");

const answer = (name: string, confidence: number): CategoryClassifier => vi.fn(async () => ({ name, confidence }));

async function defaultCategoryId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function newApproval(label: string): Promise<{ g: GroupFixture; id: string }> {
  const g = await createGroupFixture(label);
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: APPROVAL, receivedAt: received, source: "manual_test" });
  return { g, id: r.transactionId! };
}

async function tx(id: string) {
  const { data, error } = await db.from("transactions").select("category_id, category_source").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("categorizeTransaction", () => {
  it("확신이 충분하면 카테고리를 넣고 출처는 ai", async () => {
    const { id } = await newApproval("cat-ok");
    const classify = answer("카페", 0.98);
    expect(await categorizeTransaction(db, classify, id)).toBe("categorized");
    expect(classify).toHaveBeenCalledWith("테스트커피 강남역점(메가", expect.any(Array));
    expect(await tx(id)).toEqual({ category_id: await defaultCategoryId("카페"), category_source: "ai" });
  });

  it("확신이 낮거나, 기타이거나, 분류기가 실패하면 미지정으로 둔다", async () => {
    for (const classify of [answer("카페", 0.5), answer("기타", 0.99), vi.fn(async () => null)]) {
      const { id } = await newApproval("cat-undecided");
      expect(await categorizeTransaction(db, classify, id)).toBe("undecided");
      expect(await tx(id)).toEqual({ category_id: null, category_source: null });
    }
  });

  it("이미 카테고리가 있으면 분류기를 부르지 않는다", async () => {
    const { id } = await newApproval("cat-skip");
    await db.from("transactions").update({ category_id: await defaultCategoryId("식비"), category_source: "rule" }).eq("id", id);
    const classify = answer("카페", 0.99);
    expect(await categorizeTransaction(db, classify, id)).toBe("skipped");
    expect(classify).not.toHaveBeenCalled();
  });

  it("jev가 답하는 사이 사용자가 고친 카테고리는 덮어쓰지 않는다", async () => {
    const { g, id } = await newApproval("cat-race");
    const food = await defaultCategoryId("식비");
    const classify: CategoryClassifier = async () => {
      await g.member.client.from("transactions").update({ category_id: food }).eq("id", id);
      return { name: "카페", confidence: 0.99 };
    };
    expect(await categorizeTransaction(db, classify, id)).toBe("skipped");
    expect(await tx(id)).toEqual({ category_id: food, category_source: "user" });
  });

  it("선택지는 기본 + 우리 그룹 카테고리이고, 다른 그룹 카테고리는 빠진다", async () => {
    const { g, id } = await newApproval("cat-options");
    const other = await createGroupFixture("cat-other");
    const { data: mine } = await db.from("categories")
      .insert({ group_id: g.groupId, name: "카페", sort_order: 10 }).select("id").single();
    await db.from("categories").insert({ group_id: other.groupId, name: "남의카테고리", sort_order: 10 });

    let seen: CategoryOption[] = [];
    const classify: CategoryClassifier = async (_m, options) => { seen = options; return { name: "카페", confidence: 0.99 }; };
    expect(await categorizeTransaction(db, classify, id)).toBe("categorized");

    const names = seen.map((o) => o.name);
    expect(names).not.toContain("남의카테고리");
    expect(names.filter((n) => n === "카페")).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining(["식비", "카페", "편의점", "교통", "쇼핑", "생활", "의료", "문화", "기타"]));
    expect(await tx(id)).toEqual({ category_id: mine!.id, category_source: "ai" });
  });

  it("수동 입력 거래는 분류하지 않는다", async () => {
    const g = await createGroupFixture("cat-manual");
    const { data } = await db.from("transactions").insert({
      group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 5000,
      merchant: "시장", occurred_at: "2026-09-23T03:00:00Z",
    }).select("id").single();
    const classify = answer("식비", 0.99);
    expect(await categorizeTransaction(db, classify, data!.id)).toBe("skipped");
    expect(classify).not.toHaveBeenCalled();
  });

  it("그룹이 숨긴 기본 카테고리는 선택지에서 빠진다", async () => {
    const { g, id } = await newApproval("cat-hidden");
    await db.from("category_hidden").insert({ group_id: g.groupId, category_id: await defaultCategoryId("문화") });
    let seen: CategoryOption[] = [];
    const classify: CategoryClassifier = async (_m, options) => { seen = options; return null; };
    await categorizeTransaction(db, classify, id);
    expect(seen.map((o) => o.name)).not.toContain("문화");
    expect(seen.map((o) => o.name)).toContain("카페");
  });

  it("결제를 분류하면 연결된 미지정 취소도 같은 카테고리가 된다", async () => {
    const { g, id } = await newApproval("cat-cancel-sync");
    const cancel = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: CANCEL, receivedAt: received, source: "manual_test" });
    expect(await tx(cancel.transactionId!)).toEqual({ category_id: null, category_source: null });

    expect(await categorizeTransaction(db, answer("카페", 0.98), id)).toBe("categorized");
    expect(await tx(cancel.transactionId!)).toEqual({ category_id: await defaultCategoryId("카페"), category_source: "ai" });
  });
});
