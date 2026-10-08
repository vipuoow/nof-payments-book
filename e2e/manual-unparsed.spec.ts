import { expect, test } from "@playwright/test";
import { signIn, readyGroupFixture } from "./support";

test("새로 추가: 빈 금액·빈 가게는 다음으로 넘어가지 않고 이유를 보여 준다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-new");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("link", { name: "새로 추가" }).click();
  const add = page.getByRole("dialog", { name: "새로 추가" });

  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("alert")).toHaveText("금액을 입력해 주세요.");
  await add.getByLabel("금액").pressSequentially("8000");
  await add.getByRole("button", { name: "다음" }).click();
  await add.getByRole("textbox").fill("   ");
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("alert")).toHaveText("어디서 썼는지 입력해 주세요.");

  // 닫으면 아무것도 저장하지 않는다
  await add.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("family-total")).toHaveText("0원 썼어요");
});
