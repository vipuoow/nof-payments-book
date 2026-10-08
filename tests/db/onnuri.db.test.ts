import { describe, expect, it } from "vitest";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture } from "../helpers/db";

const db = adminClient();

describe("온누리상품권 결제 표시", () => {
  it("그룹 구성원은 거래를 온누리상품권 결제로 표시하고 되돌릴 수 있다", async () => {
    const g = await createGroupFixture("onnuri");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: APPROVAL, receivedAt: new Date("2026-09-23T08:40:00+09:00"), source: "manual_test" });
    const tx = r.transactionId!;
    // 배우자(그룹원)도 표시할 수 있다
    const on = await g.member.client.from("transactions").update({ paid_with: "onnuri" }).eq("id", tx).select("paid_with").single();
    expect(on.error).toBeNull();
    expect(on.data).toEqual({ paid_with: "onnuri" });
    const off = await g.member.client.from("transactions").update({ paid_with: null }).eq("id", tx).select("paid_with").single();
    expect(off.data).toEqual({ paid_with: null });
  });

  it("정해진 값(onnuri) 말고는 넣을 수 없고, 다른 그룹 거래는 바꿀 수 없다", async () => {
    const g = await createGroupFixture("onnuri2");
    const other = await createGroupFixture("onnuri3");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: APPROVAL, receivedAt: new Date("2026-09-23T08:40:00+09:00"), source: "manual_test" });
    const bad = await g.owner.client.from("transactions").update({ paid_with: "cash" }).eq("id", r.transactionId!);
    expect(bad.error).not.toBeNull();
    const foreign = await other.owner.client.from("transactions").update({ paid_with: "onnuri" }).eq("id", r.transactionId!).select("id");
    expect(foreign.data).toEqual([]);
  });
});
