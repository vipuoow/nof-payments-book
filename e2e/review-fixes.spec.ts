import { expect, test } from "@playwright/test";
import { adminClient } from "../tests/helpers/db";
import { signIn, readyGroupFixture, startDirect } from "./support";

const db = adminClient();

test("입력칸은 16px 이상이라 아이폰이 확대하지 않는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-zoom");
  await signIn(context, g.owner.email);
  await page.goto("/?add=1");
  await startDirect(page);
  const add = page.getByRole("dialog", { name: "새로 추가" });
  const sizes: number[] = [];
  const read = async () => sizes.push(...await add.locator("input").evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize))));
  await expect(add.getByLabel("금액")).toBeVisible();
  await read(); // 금액
  await add.getByLabel("금액").pressSequentially("1000");
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("heading", { name: "어디서 썼나요?" })).toBeVisible();
  await read(); // 가게
  await add.getByRole("textbox").fill("시장");
  await add.getByRole("button", { name: "다음" }).click();
  await add.getByRole("button", { name: "미지정", exact: true }).click();
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("heading", { name: "언제 썼나요?" })).toBeVisible();
  await read(); // 날짜·시각
  expect(sizes.length).toBeGreaterThanOrEqual(4);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(16);
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
