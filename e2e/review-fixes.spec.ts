import { expect, test } from "@playwright/test";
import { APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient } from "../tests/helpers/db";
import { at, signIn, kstStamp, readyGroupFixture } from "./support";

const db = adminClient();

test("검증 오류 뒤에도 사람·카테고리 선택이 유지된다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-select");
  await signIn(context, g.owner.email);
  await page.goto("/new");
  await page.getByLabel("사람").selectOption(g.member.userId);
  await page.getByLabel("카테고리").selectOption({ label: "식비" });
  await page.getByLabel("가맹점").fill("시장");
  await page.getByLabel("금액").fill("1.5");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("사람")).toHaveValue(g.member.userId);
  await expect(page.getByLabel("카테고리").locator("option:checked")).toHaveText("식비");
  await expect(page.getByLabel("가맹점")).toHaveValue("시장");
});

test("거래 시트의 입력칸은 16px 이상이라 아이폰이 확대하지 않는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-zoom");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(3)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  await page.getByRole("dialog", { name: "거래 수정" }).getByText("더 보기").click();
  const sizes = await page.locator('[role="dialog"] input:not([type=hidden]), [role="dialog"] select')
    .evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16);
});

test("카테고리를 고른 뒤 뒤로 가도 시트가 다시 열리지 않는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-back");
  await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(3)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByTestId("tx-row").first().click();
  await page.getByRole("dialog", { name: "거래 수정" }).getByRole("button", { name: "카페", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("family-total")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("미분류 문자를 등록한 뒤 뒤로 가면 입력 화면이 아니라 목록으로 간다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-raw-back");
  await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: UNKNOWN_KB, receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);
  await page.goto("/unparsed");
  await page.getByRole("link", { name: "거래로 등록" }).click();
  await page.getByLabel("금액").fill("1000");
  await page.getByLabel("가맹점").fill("카드 결제");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("family-total")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/unparsed$/);
});

test("한 달 거래가 많아도(승인 400건) 홈이 열린다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-many");
  const now = Date.now();
  const rows = Array.from({ length: 400 }, (_, i) => ({
    group_id: g.groupId, user_id: g.owner.userId, kind: "approval", amount: 1000,
    merchant: `가게${i}`, occurred_at: new Date(now - i * 1000).toISOString(),
  }));
  const { error } = await db.from("transactions").insert(rows);
  expect(error).toBeNull();
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("family-total")).toHaveText("400,000원 썼어요");
});
