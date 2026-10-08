import { describe, expect, it } from "vitest";
import { APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { createManualTx, deleteManualTx, editTx, ignoreRaw, setOnnuri } from "@/ledger/tx-edit";
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
