import { expect, test } from "@playwright/test";
import { APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture } from "../tests/helpers/db";
import { at, kstStamp, signIn } from "./support";

const db = adminClient();

test("이미 처리된 문자는 무시·등록할 수 없고 거래도 만들지 않는다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-raw-done");
  await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: UNKNOWN_KB, receivedAt: new Date(), source: "manual_test" });
  const { data: raw } = await db.from("raw_messages").select("id").eq("group_id", g.groupId).single();
  await signIn(context, g.owner.email);

  await page.goto(`/new?raw=${raw!.id}`);
  await db.from("raw_messages").update({ status: "ignored" }).eq("id", raw!.id); // 다른 사람이 먼저 처리
  await page.getByLabel("금액").fill("1000");
  await page.getByLabel("가맹점").fill("카드 결제");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("이미 처리된 문자입니다.");
  expect((await db.from("transactions").select("id").eq("group_id", g.groupId)).data).toEqual([]);

  await db.from("raw_messages").update({ status: "unparsed" }).eq("id", raw!.id);
  await page.goto("/unparsed");
  await db.from("raw_messages").update({ status: "parsed" }).eq("id", raw!.id);
  await page.getByRole("button", { name: "무시" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("이미 처리된 문자입니다.");
  expect((await db.from("raw_messages").select("status").eq("id", raw!.id).single()).data).toEqual({ status: "parsed" });
});

test("이미 지워진 거래를 삭제하면 오류를 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-del-gone");
  const { data: tx } = await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 5000,
    merchant: "시장", occurred_at: new Date(Date.now() - 60_000).toISOString(),
  }).select("id").single();
  await signIn(context, g.owner.email);
  page.on("dialog", (d) => d.accept());
  await page.goto(`/?tx=${tx!.id}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await sheet.getByText("더 보기").click();
  await db.from("transactions").delete().eq("id", tx!.id);
  await sheet.getByRole("button", { name: "삭제" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("저장하지 못했습니다. 다시 시도해 주세요.");
});

test("시트는 모달로 포커스를 받고 배경 스크롤을 잠그며, 메뉴는 바깥을 탭하면 닫힌다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-a11y");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(2)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);

  await page.goto(`/?tx=${r.transactionId}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.getByRole("link", { name: "닫기" }).click({ position: { x: 20, y: 20 } }); // 시트 위쪽 빈 배경
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

  await page.getByLabel("메뉴").click();
  await expect(page.getByRole("link", { name: "그룹" })).toBeVisible();
  await page.mouse.click(380, 200); // 펼친 메뉴(왼쪽)에 가려지지 않는 오른쪽 빈 곳
  await expect(page.getByRole("link", { name: "그룹" })).toBeHidden();
});
