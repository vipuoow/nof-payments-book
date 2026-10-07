import { expect, test } from "@playwright/test";
import { budgetMonth } from "@/ledger/budget";
import { kstMonthOf } from "@/ledger/month";
import { adminClient } from "../tests/helpers/db";
import { readyGroupFixture, signIn } from "./support";

const db = adminClient();
const id = async (name: string) => (await db.from("categories").select("id").is("group_id", null).eq("name", name).single()).data!.id;

test("분류별 예산을 정하면 이번 달부터 저장되고, 비우면 0으로 꺼지며, 잘못된 값은 칸 아래에 이유가 나온다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-budget-page");
  const cafe = await id("카페");
  await signIn(context, g.owner.email);
  await page.goto("/limit");
  await page.getByRole("link", { name: "분류별 예산 ›" }).click();
  await expect(page.getByLabel("가족 전체 예산")).toHaveCount(0);

  await page.getByLabel("카페 예산").fill("abc");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("0 이상 숫자로 입력해 주세요.");

  await page.getByLabel("카페 예산").fill("50000");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("family-total")).toBeVisible();

  const month = budgetMonth(kstMonthOf(new Date()));
  const rows = async () =>
    (await db.from("budgets").select("category_id, month, amount").eq("group_id", g.groupId).not("category_id", "is", null)).data;
  expect(await rows()).toEqual([{ category_id: cafe, month, amount: 50000 }]);

  // 카페 칸을 비우면 0(끔)
  await page.goto("/budget");
  await expect(page.getByLabel("카페 예산")).toHaveValue("50,000");
  await page.getByLabel("카페 예산").fill("");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("family-total")).toBeVisible();
  expect(await rows()).toEqual([{ category_id: cafe, month, amount: 0 }]);
});

test("열어 둔 예산 화면에서 저장해도 그사이 다른 사람이 바꾼 칸은 덮어쓰지 않는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-budget-stale");
  const cafe = await id("카페");
  const month = budgetMonth(kstMonthOf(new Date()));
  await db.from("budgets").insert({ group_id: g.groupId, category_id: cafe, month, amount: 50000 });
  await signIn(context, g.owner.email);
  await page.goto("/budget");
  await expect(page.getByLabel("카페 예산")).toHaveValue("50,000");

  await db.from("budgets").update({ amount: 70000 }).eq("group_id", g.groupId).eq("category_id", cafe); // 배우자가 변경
  await page.getByLabel("식비 예산").fill("300000");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("family-total")).toBeVisible();
  const { data } = await db.from("budgets").select("amount").eq("group_id", g.groupId).eq("category_id", cafe).single();
  expect(data).toEqual({ amount: 70000 });
});
