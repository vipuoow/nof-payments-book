import { expect, test, type Page } from "@playwright/test";
import { kstMonthOf, monthLabel, monthRange, shiftMonth } from "@/ledger/month";
import { adminClient } from "../tests/helpers/db";
import { readyGroupFixture, signIn } from "./support";

// 한도 카드로 달을 넘길 때: 카드는 사라지지 않고, 기다리는 동안 자리표시를 보여 준다
const db = adminClient();

async function grabCard(page: Page, dx: number) {
  const box = (await page.locator(".spend-card").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y);
}
/** 화면 전환용 서버 응답(RSC)만 늦춘다 */
async function slowNavigation(page: Page, ms: number) {
  await page.route(/\/\?month=/, async (route) => {
    if (route.request().headers()["rsc"]) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test("느린 연결에서 카드를 밀면 카드는 그대로 새 달 이름과 자리표시를 보이고, 데이터가 오면 채운다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-month-switch");
  const prev = shiftMonth(kstMonthOf(new Date()), -1);
  await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 7000, merchant: "지난달 가게",
    occurred_at: new Date(monthRange(prev).from.getTime() + 86_400_000).toISOString(),
  });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await slowNavigation(page, 1500);

  const card = page.locator(".spend-card");
  await grabCard(page, 120);
  await page.mouse.up();
  await expect(card.locator("h1")).toHaveText(monthLabel(prev));
  await expect(card).toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("month-skeleton")).toBeVisible();
  await expect(page.getByTestId("family-total")).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(await page.locator(".spend-slide").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  await expect(page.getByTestId("family-total")).toHaveText("7,000원 썼어요");
  await expect(card).not.toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("month-skeleton")).toHaveCount(0);
  await expect(page.getByTestId("tx-row").filter({ hasText: "지난달 가게" })).toBeVisible();
});

test("달 링크를 눌러도 같은 방식으로 기다린다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-month-link");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await slowNavigation(page, 1500);
  await page.getByRole("link", { name: "이전 달" }).click();
  await expect(page.locator(".spend-card h1")).toHaveText(monthLabel(shiftMonth(kstMonthOf(new Date()), -1)));
  await expect(page.getByTestId("month-skeleton")).toBeVisible();
  await expect(page.getByTestId("month-skeleton")).toHaveCount(0, { timeout: 10_000 });
});

test("덜 밀고 놓으면 툭 튀지 않고 미끄러져 제자리로 돌아온다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-month-bounce");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await grabCard(page, 40);
  await page.mouse.up();
  const slide = page.locator(".spend-slide");
  expect(await slide.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  expect(await slide.evaluate((el) => (el as HTMLElement).style.transform)).toBe("");
});
