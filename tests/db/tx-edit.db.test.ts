import { describe, expect, it } from "vitest";
import { APPROVAL, FOREIGN_APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { createManualTx, deleteManualTx, editTx, ignoreRaw, ruleCategoryFor, setOnnuri, type NewTx } from "@/ledger/tx-edit";
import { adminClient, createGroupFixture, type GroupFixture } from "../helpers/db";

const db = adminClient();
const now = new Date();
const kstLocal = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16);

async function cardTx(g: GroupFixture) {
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: APPROVAL, receivedAt: new Date("2026-09-23T08:40:00+09:00"), source: "manual_test" });
  return r.transactionId!;
}

async function manualTx(g: GroupFixture) {
  const r = await createManualTx(g.owner.client, g.groupId, {
    amount: "8000", merchant: "시장", occurredAt: kstLocal(now), userId: g.owner.userId, categoryId: null,
  }, now);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

const unparsedOf = async (userId: string) =>
  (await db.from("raw_messages").select("id").eq("user_id", userId).eq("status", "unparsed").single()).data!.id;

const row = async (id: string) =>
  (await db.from("transactions").select("amount, merchant, user_id, category_id, paid_with").eq("id", id).maybeSingle()).data;

describe("거래 상세에서 한 항목씩 고치기", () => {
  it("카드 문자 거래는 분류만 고칠 수 있다(금액·가게·언제·누가는 서버가 거절)", async () => {
    const g = await createGroupFixture("txe-card");
    const id = await cardTx(g);
    const cafe = (await db.from("categories").select("id").eq("name", "카페").is("group_id", null).single()).data!.id;
    expect(await editTx(g.owner.client, id, { categoryId: cafe }, now)).toEqual({ ok: true });
    expect((await row(id))?.category_id).toBe(cafe);
    for (const patch of [{ amount: "1" }, { merchant: "x" }, { occurredAt: kstLocal(now) }, { userId: g.member.userId }]) {
      expect(await editTx(g.owner.client, id, patch, now)).toEqual({ ok: false, error: "카드 문자로 들어온 거래는 분류만 고칠 수 있어요." });
    }
    expect(await row(id)).toMatchObject({ amount: 12300, merchant: "테스트커피 강남역점(메가", user_id: g.owner.userId });
  });

  it("직접 추가한 거래는 모든 항목을 고친다. 잘못된 값은 이유를 돌려준다", async () => {
    const g = await createGroupFixture("txe-manual");
    const id = await manualTx(g);
    expect(await editTx(g.member.client, id, { amount: "13,325" }, now)).toEqual({ ok: true });
    expect(await editTx(g.member.client, id, { merchant: " 마트 " }, now)).toEqual({ ok: true });
    expect(await editTx(g.member.client, id, { userId: g.member.userId }, now)).toEqual({ ok: true });
    expect(await row(id)).toMatchObject({ amount: 13325, merchant: "마트", user_id: g.member.userId });
    expect(await editTx(g.member.client, id, { amount: "0" }, now)).toEqual({ ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." });
    expect(await editTx(g.member.client, id, { occurredAt: "2999-01-01T00:00" }, now)).toEqual({ ok: false, error: "일시를 확인해 주세요." });
  });

  it("다른 그룹 거래는 고치지도, 지우지도, 온누리로 표시하지도 못한다", async () => {
    const g = await createGroupFixture("txe-own");
    const other = await createGroupFixture("txe-other");
    const id = await manualTx(g);
    expect((await editTx(other.owner.client, id, { amount: "1" }, now)).ok).toBe(false);
    expect((await deleteManualTx(other.owner.client, id)).ok).toBe(false);
    expect((await setOnnuri(other.owner.client, id, true)).ok).toBe(false);
    expect((await row(id))?.amount).toBe(8000);
  });

  it("온누리 표시를 켜고 끈다", async () => {
    const g = await createGroupFixture("txe-onnuri");
    const id = await cardTx(g);
    expect(await setOnnuri(g.owner.client, id, true)).toEqual({ ok: true });
    expect((await row(id))?.paid_with).toBe("onnuri");
    expect(await setOnnuri(g.owner.client, id, false)).toEqual({ ok: true });
    expect((await row(id))?.paid_with).toBeNull();
  });
});

describe("밀어서 삭제", () => {
  it("직접 추가한 거래만 지운다", async () => {
    const g = await createGroupFixture("txe-del");
    const card = await cardTx(g);
    const manual = await manualTx(g);
    expect(await deleteManualTx(g.owner.client, card)).toEqual({ ok: false, error: "카드 문자로 들어온 거래는 지울 수 없어요." });
    expect(await row(card)).not.toBeNull();
    expect(await deleteManualTx(g.owner.client, manual)).toEqual({ ok: true });
    expect(await row(manual)).toBeNull();
  });
});

describe("새로 추가와 확인할 문자", () => {
  it("문자에서 등록하면 그 문자는 처리됨이 되고, 두 번 등록하거나 무시할 수 없다", async () => {
    const g = await createGroupFixture("txe-raw");
    await ingestMessage(db, { userId: g.member.userId, groupId: g.groupId },
      { body: UNKNOWN_KB, receivedAt: now, source: "manual_test" });
    const rawId = await unparsedOf(g.member.userId);
    const input = { amount: "1234567", merchant: "카드 결제", occurredAt: kstLocal(now), userId: g.member.userId, categoryId: null, rawId };
    const saved = await createManualTx(g.owner.client, g.groupId, input, now);
    expect(saved.ok).toBe(true);
    expect((await db.from("raw_messages").select("status").eq("id", rawId).single()).data?.status).toBe("parsed");
    expect(await createManualTx(g.owner.client, g.groupId, input, now)).toEqual({ ok: false, error: "이미 처리된 문자입니다." });
    expect(await ignoreRaw(g.owner.client, rawId)).toEqual({ ok: false, error: "이미 처리된 문자입니다." });
  });

  it("무시하면 ignored가 된다. 잘못된 입력은 저장하지 않는다", async () => {
    const g = await createGroupFixture("txe-ign");
    await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: `${UNKNOWN_KB}\n둘`, receivedAt: now, source: "manual_test" });
    const rawId = await unparsedOf(g.owner.userId);
    expect(await ignoreRaw(g.owner.client, rawId)).toEqual({ ok: true });
    expect((await db.from("raw_messages").select("status").eq("id", rawId).single()).data?.status).toBe("ignored");
    expect(await createManualTx(g.owner.client, g.groupId, {
      amount: "", merchant: "x", occurredAt: kstLocal(now), userId: g.owner.userId, categoryId: null,
    }, now)).toEqual({ ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." });
  });
});

describe("검토 반영", () => {
  it("카드 문자 거래는 DB에서도 금액·가게·언제·누가를 바꾸거나 지울 수 없다(분류·온누리는 된다)", async () => {
    const g = await createGroupFixture("txe-db");
    const id = await cardTx(g);
    for (const patch of [{ amount: 1 }, { merchant: "x" }, { occurred_at: new Date().toISOString() }, { user_id: g.member.userId }]) {
      const r = await g.member.client.from("transactions").update(patch).eq("id", id);
      expect(r.error).not.toBeNull();
    }
    const del = await g.member.client.from("transactions").delete().eq("id", id).select("id");
    expect(del.data ?? []).toEqual([]);
    expect(await row(id)).toMatchObject({ amount: 12300, merchant: "테스트커피 강남역점(메가" });
    expect((await g.member.client.from("transactions").update({ paid_with: "onnuri" }).eq("id", id)).error).toBeNull();
    // 직접 추가한 거래는 그대로 고칠 수 있다
    const manual = await manualTx(g);
    expect((await g.member.client.from("transactions").update({ amount: 9 }).eq("id", manual)).error).toBeNull();
  });

  it("같은 문자를 둘이 동시에 등록해도 거래는 하나만 생긴다", async () => {
    const g = await createGroupFixture("txe-race");
    await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: UNKNOWN_KB, receivedAt: now, source: "manual_test" });
    const rawId = await unparsedOf(g.owner.userId);
    const input = { amount: "1000", merchant: "결제", occurredAt: kstLocal(now), userId: g.owner.userId, categoryId: null, rawId };
    const results = await Promise.all([
      createManualTx(g.owner.client, g.groupId, input, now), createManualTx(g.member.client, g.groupId, input, now),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await db.from("transactions").select("id").eq("group_id", g.groupId)).data).toHaveLength(1);
  });

  it("이상한 입력은 오류로 끝나지 않고 거절한다", async () => {
    const g = await createGroupFixture("txe-junk");
    const card = await cardTx(g);
    const bad = { ok: false, error: "저장하지 못했습니다. 다시 시도해 주세요." };
    expect(await editTx(g.owner.client, card, null as never, now)).toEqual(bad);
    expect(await editTx(g.owner.client, card, { amount: 5 as never }, now)).toEqual(bad);
    expect(await editTx(g.owner.client, card, { categoryId: null, amount: "1" }, now)).toEqual(bad); // 한 번에 한 항목
    expect(await setOnnuri(g.owner.client, card, "false" as never)).toEqual(bad);
    expect(await createManualTx(g.owner.client, g.groupId, null as never, now)).toEqual(bad);
  });
});

describe("붙여넣기 저장: 겹침 확인과 가맹점 규칙", () => {
  const input = (g: GroupFixture, extra: Partial<NewTx> = {}): NewTx => ({
    amount: "12300", merchant: "테스트커피", occurredAt: "2026-09-23T08:28", userId: g.owner.userId, categoryId: null, ...extra,
  });
  const later = new Date("2026-09-23T09:00:00+09:00");

  it("같은 사람·금액·5분 안의 카드 결제가 있으면 저장하지 않고 그 거래를 알려 준다", async () => {
    const g = await createGroupFixture("paste-overlap");
    await cardTx(g); // 09/23 08:26 12,300원
    const r = await createManualTx(g.owner.client, g.groupId, input(g, { checkOverlap: true }), later);
    expect(r).toEqual({
      ok: false, error: "이미 들어온 결제 같아요",
      overlap: { merchant: "테스트커피 강남역점(메가", amount: 12300, occurredAt: new Date("2026-09-23T08:26:00+09:00").toISOString() },
    });
    expect((await db.from("transactions").select("id").eq("group_id", g.groupId).eq("kind", "manual")).data).toHaveLength(0);
  });

  it("그래도 저장(확인 없이)은 저장된다. 확인을 켜지 않은 직접 적기도 그대로", async () => {
    const g = await createGroupFixture("paste-force");
    await cardTx(g);
    expect((await createManualTx(g.owner.client, g.groupId, input(g), later)).ok).toBe(true);
  });

  it("같은 문자를 두 번 붙여 넣으면 두 번째는 겹친다(직접 추가끼리)", async () => {
    const g = await createGroupFixture("paste-twice");
    expect((await createManualTx(g.owner.client, g.groupId, input(g, { checkOverlap: true }), later)).ok).toBe(true);
    const second = await createManualTx(g.owner.client, g.groupId, input(g, { checkOverlap: true }), later);
    expect(second.ok).toBe(false);
  });

  it("다른 사람의 같은 금액 결제는 겹치지 않는다", async () => {
    const g = await createGroupFixture("paste-other");
    await cardTx(g);
    const r = await createManualTx(g.owner.client, g.groupId, input(g, { userId: g.member.userId, checkOverlap: true }), later);
    expect(r.ok).toBe(true);
  });

  it("가맹점 규칙: 우리 가계부에 같은 가게 규칙이 있으면 그 분류, 없으면 null(다른 가계부 규칙은 안 보임)", async () => {
    const g = await createGroupFixture("paste-rule");
    const other = await createGroupFixture("paste-rule-other");
    const cafe = (await db.from("categories").select("id").eq("name", "카페").is("group_id", null).single()).data!.id;
    await db.from("merchant_rules").insert({ group_id: g.groupId, merchant_pattern: "테스트커피", category_id: cafe });
    expect(await ruleCategoryFor(g.owner.client, " 테스트커피 ")).toBe(cafe);
    expect(await ruleCategoryFor(g.owner.client, "모르는가게")).toBeNull();
    expect(await ruleCategoryFor(other.owner.client, "테스트커피")).toBeNull();
  });
});

describe("해외 결제 금액 고치기", () => {
  it("해외 결제는 금액을 고칠 수 있고 예상 표시가 꺼진다, 다른 항목은 여전히 거절", async () => {
    const g = await createGroupFixture("txe-fx");
    await db.from("fx_rates").upsert({ date: "2026-10-02", base: "KRW", rates: { KRW: 1, USD: 0.000745 } });
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: FOREIGN_APPROVAL, receivedAt: new Date("2026-10-05T12:00:00+09:00"), source: "manual_test" });
    const id = r.transactionId!;
    expect(await editTx(g.owner.client, id, { amount: "11,000" }, now)).toEqual({ ok: true });
    const { data } = await db.from("transactions").select("amount, amount_estimated").eq("id", id).single();
    expect(data).toEqual({ amount: 11000, amount_estimated: false });
    expect(await editTx(g.owner.client, id, { merchant: "x" }, now)).toEqual({ ok: false, error: "카드 문자로 들어온 거래는 분류만 고칠 수 있어요." });
  });
});
