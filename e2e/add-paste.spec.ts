import { expect, test } from "@playwright/test";
import { readyGroupFixture, signIn } from "./support";

test("+를 누르면 '결제 직접 입력'이 펼쳐지고, 3초 뒤 + 하나만 남는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-menu");
  await signIn(context, g.owner.email);
  await page.goto("/");
  const plus = page.getByRole("button", { name: "결제 입력 메뉴" });
  const pill = page.getByRole("link", { name: "결제 직접 입력" });
  await expect(pill).toHaveCount(0);
  await plus.click();
  await expect(plus).toHaveAttribute("aria-expanded", "true");
  await expect(pill).toBeVisible();
  await page.waitForTimeout(3300);
  await expect(pill).toHaveCount(0);
  await expect(plus).toHaveAttribute("aria-expanded", "false");

  // ×(펼친 + 버튼)를 다시 누르면 바로 접힌다
  await plus.click();
  await expect(pill).toBeVisible();
  await plus.click();
  await expect(pill).toHaveCount(0);
});

test("알약을 누르면 새로 추가가 열리고 메뉴는 접힌다. 닫은 뒤 +를 다시 누르면 다시 펼쳐진다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-menu-open");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  await page.getByRole("link", { name: "결제 직접 입력" }).click();
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await expect(add).toBeVisible();
  await page.waitForTimeout(3300); // 남은 타이머가 있어도 문제없다
  await add.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "결제 직접 입력" })).toHaveCount(0);
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  await expect(page.getByRole("link", { name: "결제 직접 입력" })).toBeVisible();
});
