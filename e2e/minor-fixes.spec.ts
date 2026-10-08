import { expect, test } from "@playwright/test";
import { APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient } from "../tests/helpers/db";
import { at, kstStamp, signIn, readyGroupFixture } from "./support";

const db = adminClient();

test("이미 처리된 문자는 등록·무시할 수 없고 거래도 만들지 않는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-raw-done");
  await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: UNKNOWN_KB, receivedAt: new Date(), source: "manual_test" });
  const { data: raw } = await db.from("raw_messages").select("id").eq("group_id", g.groupId).single();
  await signIn(context, g.owner.email);

  await page.goto(`/new?raw=${raw!.id}`);
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("textbox").fill("카드 결제"); // 금액은 문자에서 찾았고 가게부터 묻는다
  await add.getByRole("button", { name: "다음" }).click();
  await add.getByRole("button", { name: "미지정", exact: true }).click();
  await add.getByRole("button", { name: "다음" }).click();
  await add.getByRole("button", { name: "다 입력했어요" }).click();
  await db.from("raw_messages").update({ status: "ignored" }).eq("id", raw!.id); // 다른 사람이 먼저 처리
  await add.getByRole("button", { name: "저장하기" }).click();
  await expect(add.getByRole("alert")).toHaveText("이미 처리된 문자입니다.");
  expect((await db.from("transactions").select("id").eq("group_id", g.groupId)).data).toEqual([]);

  await db.from("raw_messages").update({ status: "unparsed" }).eq("id", raw!.id);
  await page.goto("/unparsed");
  await db.from("raw_messages").update({ status: "parsed" }).eq("id", raw!.id);
  await page.getByRole("dialog", { name: "확인할 문자" }).getByRole("button", { name: "무시" }).click();
  await expect(page.getByRole("status")).toHaveText("이미 처리된 문자입니다.");
  expect((await db.from("raw_messages").select("status").eq("id", raw!.id).single()).data).toEqual({ status: "parsed" });
});

test("이미 지워진 거래를 지우면 오류를 알려 준다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-del-gone");
  await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 5000,
    merchant: "시장", occurred_at: new Date(Date.now() - 60_000).toISOString(),
  });
  await signIn(context, g.owner.email);
  await page.goto("/");
  const row = page.getByTestId("tx-row").filter({ hasText: "시장" });
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 80, box.y + box.height / 2, { steps: 6 });
  await page.mouse.move(box.x + box.width - 140, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "지우기" }).click();
  await db.from("transactions").delete().eq("group_id", g.groupId);
  await page.getByRole("alertdialog").getByRole("button", { name: "지우기" }).click();
  await expect(page.getByRole("status")).toHaveText("저장하지 못했습니다. 다시 시도해 주세요.");
});

test("거래 상세는 모달로 포커스를 받고 배경 스크롤을 잠그며, 메뉴는 바깥을 탭하면 닫힌다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-a11y");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(2)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);

  await page.goto(`/?tx=${r.transactionId}`);
  const detail = page.getByRole("dialog", { name: "거래 상세" });
  await expect(detail).toHaveAttribute("aria-modal", "true");
  await expect(detail).toBeFocused();
  const overflow = () => page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(await overflow()).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await overflow()).not.toBe("hidden");

  await page.getByLabel("메뉴", { exact: true }).click();
  await expect(page.getByRole("link", { name: "카테고리" })).toBeVisible();
  await page.mouse.click(380, 200); // 펼친 메뉴(왼쪽)에 가려지지 않는 오른쪽 빈 곳
  await expect(page.getByRole("link", { name: "카테고리" })).toBeHidden();
});
