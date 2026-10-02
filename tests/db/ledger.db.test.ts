import { describe, expect, it } from "vitest";
import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, anonClient, createGroupFixture, type GroupFixture } from "../helpers/db";

const db = adminClient();
const received = new Date("2026-10-02T13:00:00+09:00");
const at = (body: string, mmdd_hhmm: string) => body.replace(/\d{2}\/\d{2} \d{2}:\d{2}/, mmdd_hhmm);

async function categoryId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function ingest(g: GroupFixture, body: string, receivedAt = received): Promise<string> {
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body, receivedAt, source: "manual_test" });
  return r.transactionId!;
}

async function tx(id: string) {
  const { data, error } = await db.from("transactions")
    .select("category_id, category_source, cancels_transaction_id").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("set_transaction_category", () => {
  it("고른 거래는 user, 규칙 저장, 같은 달 같은 가맹점의 미지정·ai 거래는 rule로 함께 바뀐다", async () => {
    const cafe = await categoryId("카페");
    const food = await categoryId("식비");
    const g = await createGroupFixture("set-cat");
    const target = await ingest(g, at(APPROVAL, "10/02 08:26"));
    const sameNull = await ingest(g, at(APPROVAL, "10/01 00:30"));   // KST 10/1 00:30 = UTC 9/30 15:30
    const sameAi = await ingest(g, at(APPROVAL, "10/02 12:00"));
    const sameUser = await ingest(g, at(APPROVAL, "10/02 12:10"));
    const prevMonth = await ingest(g, at(APPROVAL, "09/30 23:50"));
    await db.from("transactions").update({ category_id: food, category_source: "ai" }).eq("id", sameAi);
    await g.member.client.from("transactions").update({ category_id: food }).eq("id", sameUser); // 트리거가 user로

    const { data, error } = await g.owner.client.rpc("set_transaction_category", { p_transaction: target, p_category: cafe });
    expect(error).toBeNull();
    expect(data).toBe(2);

    expect(await tx(target)).toMatchObject({ category_id: cafe, category_source: "user" });
    expect(await tx(sameNull)).toMatchObject({ category_id: cafe, category_source: "rule" });
    expect(await tx(sameAi)).toMatchObject({ category_id: cafe, category_source: "rule" });
    expect(await tx(sameUser)).toMatchObject({ category_id: food, category_source: "user" });
    expect(await tx(prevMonth)).toMatchObject({ category_id: null, category_source: null });

    const { data: rule } = await db.from("merchant_rules").select("category_id")
      .eq("group_id", g.groupId).eq("merchant_pattern", "테스트커피 강남역점(메가").single();
    expect(rule!.category_id).toBe(cafe);
  });

  it("다시 고치면 규칙이 갱신되고, 미지정으로 되돌리면 그 거래만 바뀌고 규칙은 남는다", async () => {
    const cafe = await categoryId("카페");
    const food = await categoryId("식비");
    const g = await createGroupFixture("set-cat-again");
    const id = await ingest(g, at(APPROVAL, "10/02 08:26"));

    await g.owner.client.rpc("set_transaction_category", { p_transaction: id, p_category: cafe });
    await g.owner.client.rpc("set_transaction_category", { p_transaction: id, p_category: food });
    const rule = () => db.from("merchant_rules").select("category_id").eq("group_id", g.groupId).single();
    expect((await rule()).data!.category_id).toBe(food);

    const { data, error } = await g.owner.client.rpc("set_transaction_category", { p_transaction: id, p_category: null });
    expect(error).toBeNull();
    expect(data).toBe(0);
    expect(await tx(id)).toMatchObject({ category_id: null, category_source: null });
    expect((await rule()).data!.category_id).toBe(food);
  });

  it("다른 그룹의 거래나 카테고리는 거부하고, 로그인하지 않으면 실행할 수 없다", async () => {
    const cafe = await categoryId("카페");
    const mine = await createGroupFixture("set-cat-mine");
    const other = await createGroupFixture("set-cat-other");
    const myTx = await ingest(mine, at(APPROVAL, "10/02 08:26"));
    const { data: otherCat } = await db.from("categories")
      .insert({ group_id: other.groupId, name: "남의카테고리", sort_order: 10 }).select("id").single();

    const r1 = await other.owner.client.rpc("set_transaction_category", { p_transaction: myTx, p_category: cafe });
    expect(r1.error?.message).toBe("not_allowed");
    const r2 = await mine.owner.client.rpc("set_transaction_category", { p_transaction: myTx, p_category: otherCat!.id });
    expect(r2.error?.message).toBe("not_allowed");
    const r3 = await anonClient().rpc("set_transaction_category", { p_transaction: myTx, p_category: cafe });
    expect(r3.error).not.toBeNull();
    expect(await tx(myTx)).toMatchObject({ category_id: null });
  });
});

describe("취소가 승인보다 먼저 도착", () => {
  it("승인이 오면 짝 없는 취소를 연결하고, 취소의 카테고리를 이어받는다", async () => {
    const cafe = await categoryId("카페");
    const g = await createGroupFixture("early-cancel");
    const cancel = await ingest(g, CANCEL, new Date("2026-09-23T08:40:00+09:00"));
    await g.owner.client.from("transactions").update({ category_id: cafe }).eq("id", cancel);

    const approval = await ingest(g, APPROVAL, new Date("2026-09-23T08:41:00+09:00"));
    expect(await tx(cancel)).toMatchObject({ cancels_transaction_id: approval });
    expect(await tx(approval)).toMatchObject({ category_id: cafe, category_source: "user" });
  });

  it("이미 짝이 있는 취소나 승인보다 이른 취소는 연결하지 않는다", async () => {
    const g = await createGroupFixture("early-cancel-no");
    const recv = new Date("2026-09-23T08:40:00+09:00");
    const first = await ingest(g, at(APPROVAL, "09/23 08:26"), recv);
    const cancel = await ingest(g, at(CANCEL, "09/23 08:30"), recv);
    expect(await tx(cancel)).toMatchObject({ cancels_transaction_id: first });

    const second = await ingest(g, at(APPROVAL, "09/23 08:28"), recv);
    expect(await tx(cancel)).toMatchObject({ cancels_transaction_id: first });
    expect(await tx(second)).toMatchObject({ cancels_transaction_id: null });

    const g2 = await createGroupFixture("early-cancel-before");
    const earlier = await ingest(g2, at(CANCEL, "09/23 08:20"), recv);
    await ingest(g2, at(APPROVAL, "09/23 08:26"), recv);
    expect(await tx(earlier)).toMatchObject({ cancels_transaction_id: null });
  });
});
