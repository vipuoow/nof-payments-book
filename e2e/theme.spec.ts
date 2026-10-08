import { expect, test } from "@playwright/test";
import { adminClient } from "../tests/helpers/db";
import { readyGroupFixture, signIn } from "./support";

const db = adminClient();

test("화면 모드: 처음은 기본, 어둡게를 고르면 새로고침 뒤에도 유지되고 배우자는 따로", async ({ page, context, browser }) => {
  const g = await readyGroupFixture("e2e-theme");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "basic");

  await page.getByLabel("메뉴").click();
  await page.getByRole("link", { name: "화면 모드" }).click();
  await expect(page.getByRole("radio", { name: /기본/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /어둡게/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(async () => (await db.from("profiles").select("theme").eq("user_id", g.owner.userId).single()).data?.theme).toBe("dark");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("radio", { name: /어둡게/ })).toHaveAttribute("aria-checked", "true");

  const other = await browser.newContext();
  await signIn(other, g.member.email);
  const spouse = await other.newPage();
  await spouse.goto("http://127.0.0.1:3100/");
  await expect(spouse.locator("html")).toHaveAttribute("data-theme", "basic");
  await other.close();
});

test("한도 카드: 남은 돈이 한도 10% 밑이면 문구, 넘으면 '우리 다음 달을 생각해요'", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-limit-card");
  const month = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7) + "-01";
  await db.from("budgets").insert({ group_id: g.groupId, category_id: null, month, amount: 100000 });
  await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 95000, merchant: "큰 지출", occurred_at: new Date(Date.now() - 60_000).toISOString(),
  });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("budget-total")).toHaveText("거의 다 썼어요");
  await expect(page.locator(".spend")).toHaveAttribute("data-level", "bad");
  await expect(page.getByTestId("family-total")).toHaveText("95,000원 썼어요");

  await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.member.userId, kind: "manual", amount: 10000, merchant: "조금 더", occurred_at: new Date(Date.now() - 30_000).toISOString(),
  });
  await page.reload();
  await expect(page.getByTestId("budget-total")).toHaveText("우리 다음 달을 생각해요");
  await expect(page.getByText(/e2e-limit-card-owner 95,000원 \| e2e-limit-card-member 10,000원/)).toBeVisible();
});
