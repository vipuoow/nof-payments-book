import { beforeAll, describe, expect, it } from "vitest";
import { APPROVAL, CANCEL, FOREIGN_APPROVAL, TRANSIT_NOTICE, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { APPROVAL as HD_APPROVAL, CANCEL as HD_CANCEL } from "@/parsers/__fixtures__/hyundai-card";
import { resolveIngestToken } from "@/ingest/auth";
import { ingestMessage, type IngestSource } from "@/ingest/service";
import {
  adminClient, createGroupFixture, createLoneUser, issueIngestToken, type GroupFixture,
} from "../helpers/db";

const db = adminClient();
const source: IngestSource = "manual_test";
const received = new Date("2026-09-23T08:40:00+09:00");

/** 같은 형식에서 일시만 바꾼 문자 */
const at = (body: string, mmdd_hhmm: string) => body.replace(/\d{2}\/\d{2} \d{2}:\d{2}/, mmdd_hhmm);

async function txOf(groupId: string) {
  const { data, error } = await db
    .from("transactions")
    .select("id, kind, amount, merchant, occurred_at, cancels_transaction_id, category_id, user_id")
    .eq("group_id", groupId)
    .order("occurred_at");
  if (error) throw error;
  return data;
}

describe("resolveIngestToken", () => {
  let g: GroupFixture;
  beforeAll(async () => { g = await createGroupFixture("tok"); });

  it("유효한 토큰은 사용자·그룹을 돌려주고 마지막 사용 시각을 남긴다", async () => {
    const token = await issueIngestToken(g.member.userId);
    const now = new Date("2026-09-23T00:00:00Z");
    expect(await resolveIngestToken(db, token, now)).toEqual({ userId: g.member.userId, groupId: g.groupId });
    const { data } = await db.from("ingest_tokens").select("last_used_at").eq("user_id", g.member.userId).single();
    expect(new Date(data!.last_used_at).toISOString()).toBe(now.toISOString());
  });

  it("없는 토큰·폐기된 토큰·그룹 없는 사용자는 null", async () => {
    expect(await resolveIngestToken(db, "nope", new Date())).toBeNull();

    const revoked = await issueIngestToken(g.owner.userId);
    await db.from("ingest_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", g.owner.userId);
    expect(await resolveIngestToken(db, revoked, new Date())).toBeNull();

    const lone = await createLoneUser("lone");
    expect(await resolveIngestToken(db, await issueIngestToken(lone.userId), new Date())).toBeNull();
  });
});

describe("ingestMessage", () => {
  it("승인 문자는 거래가 되고 원문은 마스킹해 저장한다", async () => {
    const g = await createGroupFixture("appr");
    const owner = { userId: g.owner.userId, groupId: g.groupId };

    const r = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source });
    expect(r.status).toBe("parsed");
    expect(r.transactionId).toBeTruthy();

    const [tx] = await txOf(g.groupId);
    expect(tx).toMatchObject({ kind: "approval", amount: 12300, merchant: "테스트커피 강남역점(메가", user_id: g.owner.userId });
    expect(new Date(tx.occurred_at).toISOString()).toBe("2026-09-22T23:26:00.000Z");

    const { data: raw } = await db.from("raw_messages").select("body, status, parser_id, source").eq("group_id", g.groupId).single();
    expect(raw).toMatchObject({ status: "parsed", parser_id: "kb-card", source });
    expect(raw!.body).not.toContain("1234");
  });

  it("같은 문자를 다시 받으면 duplicate이고 거래는 하나", async () => {
    const g = await createGroupFixture("dup");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source });
    const again = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source });
    expect(again).toEqual({ status: "duplicate" });
    expect(await txOf(g.groupId)).toHaveLength(1);
  });

  it("승인 → 취소 → 같은 금액 재승인: 취소는 첫 승인에만 연결되고 합계는 재승인 금액", async () => {
    const g = await createGroupFixture("cancel");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    await ingestMessage(db, owner, { body: at(APPROVAL, "09/23 08:26"), receivedAt: received, source });
    await ingestMessage(db, owner, { body: at(CANCEL, "09/23 08:27"), receivedAt: received, source });
    await ingestMessage(db, owner, { body: at(APPROVAL, "09/23 08:28"), receivedAt: received, source });

    const [first, cancel, second] = await txOf(g.groupId);
    expect(cancel).toMatchObject({ kind: "cancel", amount: -12300, cancels_transaction_id: first.id });
    expect(second.kind).toBe("approval");
    expect(first.amount + cancel.amount + second.amount).toBe(12300);
  });

  it("같은 분 안에 승인 → 취소 → 재승인(문자 동일)이어도 재승인은 새 거래", async () => {
    const g = await createGroupFixture("sameminute");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    const approval = at(APPROVAL, "09/23 08:26");
    const cancel = at(CANCEL, "09/23 08:26");
    expect((await ingestMessage(db, owner, { body: approval, receivedAt: received, source })).status).toBe("parsed");
    expect((await ingestMessage(db, owner, { body: cancel, receivedAt: received, source })).status).toBe("parsed");
    expect((await ingestMessage(db, owner, { body: approval, receivedAt: received, source })).status).toBe("parsed");
    // 재승인 문자가 한 번 더 오면(자동화 중복 실행) 그때는 중복
    expect(await ingestMessage(db, owner, { body: approval, receivedAt: received, source })).toEqual({ status: "duplicate" });

    const txs = await txOf(g.groupId);
    expect(txs).toHaveLength(3);
    expect(txs.reduce((sum, t) => sum + t.amount, 0)).toBe(12300);
  });

  it("[Web발신] 없음·CRLF·공백만 다른 같은 문자는 중복", async () => {
    const g = await createGroupFixture("normdup");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source });
    const altered = APPROVAL.replace("[Web발신]\n", "").replace(/\n/g, "  \r\n");
    expect(await ingestMessage(db, owner, { body: altered, receivedAt: received, source })).toEqual({ status: "duplicate" });
    expect(await txOf(g.groupId)).toHaveLength(1);
  });

  it("거래 저장이 실패하면 원문도 남지 않아 재전송 시 정상 처리된다", async () => {
    const g = await createGroupFixture("atomic");
    const args = {
      p_group: g.groupId, p_user: g.owner.userId, p_body: "원문", p_body_hash: `atomic-${g.groupId}`,
      p_source: source, p_received_at: received.toISOString(), p_status: "parsed", p_parser_id: "kb-card",
      p_kind: "approval", p_amount: 1000, p_occurred_at: received.toISOString(), p_issuer: "kb",
    };
    // 가맹점 누락으로 거래 insert가 실패하도록 만든다
    const failed = await db.rpc("ingest_sms", { ...args, p_merchant: null });
    expect(failed.error).not.toBeNull();
    const { data: raws } = await db.from("raw_messages").select("id").eq("group_id", g.groupId);
    expect(raws).toEqual([]);

    const retried = await db.rpc("ingest_sms", { ...args, p_merchant: "재전송상점" });
    expect(retried.error).toBeNull();
    expect(retried.data).toMatchObject({ status: "parsed" });
    expect(await txOf(g.groupId)).toHaveLength(1);
  });

  it("다른 사람의 승인에는 취소가 연결되지 않는다", async () => {
    const g = await createGroupFixture("cross");
    await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: APPROVAL, receivedAt: received, source });
    await ingestMessage(db, { userId: g.member.userId, groupId: g.groupId }, { body: CANCEL, receivedAt: received, source });
    const cancel = (await txOf(g.groupId)).find((t) => t.kind === "cancel")!;
    expect(cancel.cancels_transaction_id).toBeNull();
  });

  it("다른 카드사의 승인에는 취소가 연결되지 않는다(금액·가맹점이 같아도)", async () => {
    const g = await createGroupFixture("issuer");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    // 국민카드 승인과 금액·가맹점이 같은 현대카드 취소
    const hdCancel = HD_CANCEL.replace("2,600원", "12,300원").replace("10/07 16:50", "09/23 08:30")
      .replace("테스트편의점 여의도점", "테스트커피 강남역점(메가");
    await ingestMessage(db, owner, { body: at(APPROVAL, "09/23 08:26"), receivedAt: received, source });
    await ingestMessage(db, owner, { body: hdCancel, receivedAt: received, source });
    const cancel = (await txOf(g.groupId)).find((t) => t.kind === "cancel")!;
    // 금액·가맹점이 정말 같아서, 카드사만 달라 연결되지 않은 것인지 확인한다
    expect(cancel).toMatchObject({ amount: -12300, merchant: "테스트커피 강남역점(메가" });
    expect(cancel.cancels_transaction_id).toBeNull();
  });

  it("먼저 온 취소도 다른 카드사의 나중 승인에는 연결되지 않는다", async () => {
    const g = await createGroupFixture("issuer-early");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    const hdCancel = HD_CANCEL.replace("2,600원", "12,300원").replace("10/07 16:50", "09/23 08:30")
      .replace("테스트편의점 여의도점", "테스트커피 강남역점(메가");
    await ingestMessage(db, owner, { body: hdCancel, receivedAt: received, source });
    await ingestMessage(db, owner, { body: at(APPROVAL, "09/23 08:26"), receivedAt: received, source });
    const cancel = (await txOf(g.groupId)).find((t) => t.kind === "cancel")!;
    // 금액·가맹점이 정말 같아서, 카드사만 달라 연결되지 않은 것인지 확인한다
    expect(cancel).toMatchObject({ amount: -12300, merchant: "테스트커피 강남역점(메가" });
    expect(cancel.cancels_transaction_id).toBeNull();
  });

  it("현대카드 승인 → 현대카드 취소는 서로 연결된다", async () => {
    const g = await createGroupFixture("hyundai");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    const recv = new Date("2026-10-07T17:00:00+09:00");
    await ingestMessage(db, owner, { body: HD_APPROVAL, receivedAt: recv, source });
    await ingestMessage(db, owner, { body: HD_CANCEL, receivedAt: recv, source });
    const [approval, cancel] = await txOf(g.groupId);
    expect(cancel).toMatchObject({ kind: "cancel", amount: -2600, cancels_transaction_id: approval.id });
  });

  it("원 승인이 없는 취소는 음수 단독 거래", async () => {
    const g = await createGroupFixture("orphan");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: CANCEL, receivedAt: received, source });
    expect(r.status).toBe("parsed");
    const [tx] = await txOf(g.groupId);
    expect(tx).toMatchObject({ kind: "cancel", amount: -12300, cancels_transaction_id: null });
  });

  it("후불교통 안내는 ignored, 모르는 문자는 unparsed로 원문만 남는다", async () => {
    const g = await createGroupFixture("ign");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    expect(await ingestMessage(db, owner, { body: TRANSIT_NOTICE, receivedAt: received, source })).toEqual({ status: "ignored" });
    expect(await ingestMessage(db, owner, { body: UNKNOWN_KB, receivedAt: received, source })).toEqual({ status: "unparsed" });
    expect(await txOf(g.groupId)).toHaveLength(0);
    const { data } = await db.from("raw_messages").select("status").eq("group_id", g.groupId).order("status");
    expect(data!.map((r) => r.status)).toEqual(["ignored", "unparsed"]);
  });

  it("가맹점 규칙이 있으면 카테고리를 붙인다", async () => {
    const g = await createGroupFixture("rule");
    const { data: cafe } = await db.from("categories").select("id").is("group_id", null).eq("name", "카페").single();
    await db.from("merchant_rules").insert({ group_id: g.groupId, merchant_pattern: "테스트커피 강남역점(메가", category_id: cafe!.id });
    await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: APPROVAL, receivedAt: received, source });
    const [tx] = await txOf(g.groupId);
    expect(tx.category_id).toBe(cafe!.id);
  });
});

describe("해외 결제 수신", () => {
  const recv = new Date("2026-10-05T12:00:00+09:00");
  it("저장된 환율로 원화를 계산해 기록한다", async () => {
    await db.from("fx_rates").upsert({ date: "2026-10-02", base: "KRW", rates: { KRW: 1, USD: 0.000745 } });
    const g = await createGroupFixture("fxin");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: FOREIGN_APPROVAL, receivedAt: recv, source });
    expect(r.status).toBe("parsed");
    const { data } = await db.from("transactions").select("amount, currency, foreign_amount, fx_rate, amount_estimated, merchant").eq("id", r.transactionId!).single();
    expect(data).toMatchObject({ amount: 10738, currency: "USD", foreign_amount: 8, fx_rate: 1342.2819, amount_estimated: true, merchant: "typesafe a" });
  });
  it("환율이 없고 받기도 실패하면 확인할 문자", async () => {
    await db.from("fx_rates").delete().gte("date", "1900-01-01");
    const g = await createGroupFixture("fxno");
    const fail = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: FOREIGN_APPROVAL, receivedAt: recv, source }, fail);
    expect(r.status).toBe("unparsed");
  });
});
