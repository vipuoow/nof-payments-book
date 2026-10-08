import { expect, test, type Page } from "@playwright/test";
import { adminClient } from "../tests/helpers/db";
import { readyGroupFixture, signIn, startDirect } from "./support";

// 화면 모드·한도 카드 검토(f6d48ff..1d11607)에서 나온 지적 사항
const db = adminClient();
const thisMonth = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7) + "-01";

/** 한도 카드를 마우스로 끈다(손을 떼지 않음) */
async function grabCard(page: Page, dx: number) {
  const box = (await page.locator(".spend-card").boundingBox())!;
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y);
  return { x, y, box };
}
const slideTransform = (page: Page) => page.locator(".spend-slide").evaluate((el) => (el as HTMLElement).style.transform);

test("한도 카드를 밀어 지난달로 가면 새 달 카드가 그대로 보인다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-swipe-month");
  await signIn(context, g.owner.email);
  await page.goto("/");
  const label = await page.locator(".spend-card h1").textContent();
  await grabCard(page, 120);
  await page.mouse.up();
  await expect(page.locator(".spend-card h1")).not.toHaveText(label!);
  await page.waitForTimeout(600);
  expect(await page.locator(".spend-slide").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
});

test("전체 한도를 0으로 지우면 '한도 원 중'을 보이지 않는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-limit-zero");
  await db.from("budgets").insert({ group_id: g.groupId, category_id: null, month: thisMonth(), amount: 0 });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("family-total")).toBeVisible();
  await expect(page.locator(".spend-limit")).toHaveCount(0);
});

test("카드를 끌다 카드 밖에서 놓으면 끌림이 끝난다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-drag-out");
  await signIn(context, g.owner.email);
  await page.goto("/");
  const { x, y, box } = await grabCard(page, 30);
  await page.mouse.move(x + 30, box.y + box.height + 200, { steps: 4 });
  await page.mouse.up();
  await page.mouse.move(x - 40, y, { steps: 4 });
  expect(await slideTransform(page)).toBe("");
});

test("카드를 조금 끌었다 놓은 뒤에도 키보드로 달 링크를 열 수 있다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-drag-key");
  await signIn(context, g.owner.email);
  await page.goto("/");
  const label = await page.locator(".spend-card h1").textContent();
  await grabCard(page, 30);
  await page.mouse.up();
  await page.getByRole("link", { name: "이전 달" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".spend-card h1")).not.toHaveText(label!);
});

test("Enter로 넘겨도 체크 버튼을 거치고, 저장 중에는 '완료'가 아니라 바쁨으로 읽힌다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-enter-check");
  const { data } = await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 8000, merchant: "엔터 시장", occurred_at: new Date(Date.now() - 60_000).toISOString(),
  }).select("id").single();
  await signIn(context, g.owner.email);

  await page.goto("/?add=1");
  await startDirect(page);
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByLabel("금액").pressSequentially("5000");
  await add.getByLabel("금액").press("Enter");
  await expect(add.locator(".check-btn")).toHaveAttribute("aria-busy", "true");
  await expect(add.getByLabel("입력한 내용").getByRole("button", { name: /금액/ })).toContainText("5000원");

  await page.goto(`/?tx=${data!.id}`);
  const detail = page.getByRole("dialog", { name: "거래 상세" });
  await detail.locator(".lx-field").filter({ hasText: "금액" }).click();
  const step = page.getByRole("region", { name: "금액 고치기" });
  await step.getByLabel("금액").fill("9000");
  await step.getByLabel("금액").press("Enter");
  const btn = step.locator(".check-btn");
  await expect(btn).toHaveAttribute("aria-busy", "true");
  await expect(btn).not.toHaveAttribute("aria-label", /완료/);
  await expect(detail.locator(".lx-field").filter({ hasText: "금액" })).toContainText("9,000원");
});

test("새로 추가 저장 중 연결이 끊기면 다시 해 달라고 알려 준다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-offline");
  await signIn(context, g.owner.email);
  await page.goto("/?add=1");
  await startDirect(page);
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByLabel("금액").pressSequentially("5000");
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByLabel("입력한 내용").getByRole("button", { name: /금액/ })).toContainText("5000원");
  await add.getByRole("textbox").fill("끊긴 가게");
  await add.getByRole("textbox").press("Enter");
  await add.getByRole("button", { name: "식비", exact: true }).click();
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("button", { name: "오늘" })).toHaveAttribute("aria-pressed", "true");
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("button", { name: "e2e-add-offline-owner" })).toHaveAttribute("aria-pressed", "true");
  await add.getByRole("button", { name: "다 입력했어요" }).click();
  await page.route("**/*", (r) => (r.request().method() === "POST" && r.request().headers()["next-action"] ? r.abort() : r.continue()));
  await add.getByRole("button", { name: "저장하기" }).click();
  await expect(add.getByRole("alert")).toHaveText("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.");
  await expect(add.getByRole("button", { name: "저장하기" })).toBeVisible();
});

test("초대 전 계정으로 로그아웃되면 화면 모드 쿠키도 지운다", async ({ page, context }) => {
  await context.addCookies([{ name: "theme", value: "dark", domain: "127.0.0.1", path: "/" }]);
  await page.goto("/auth/no-profile");
  await expect(page).toHaveURL(/error=no_profile/);
  expect((await context.cookies()).find((c) => c.name === "theme")).toBeUndefined();
});

test("손가락으로 밀 때(안쪽 글자에서 잡기가 옮겨 와도) 달이 바뀐다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-swipe-touch");
  await signIn(context, g.owner.email);
  await page.goto("/");
  const label = await page.locator(".spend-card h1").textContent();
  const { x, y } = await grabCard(page, 30);
  // 손가락은 처음 닿은 안쪽 요소에 묶여 있다가 카드로 옮겨지며, 그 요소에서 '잡기 놓침'이 올라온다
  await page.getByTestId("family-total").dispatchEvent("lostpointercapture", { bubbles: true, pointerId: 1 });
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + 30 + (90 * i) / 6, y);
  await page.mouse.up();
  await expect(page.locator(".spend-card h1")).not.toHaveText(label!);
});
