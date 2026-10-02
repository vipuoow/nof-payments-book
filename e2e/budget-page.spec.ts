import { expect, test } from "@playwright/test";
import { budgetMonth } from "@/ledger/budget";
import { kstMonthOf } from "@/ledger/month";
import { adminClient, createGroupFixture } from "../tests/helpers/db";
import { signIn } from "./support";

const db = adminClient();

test("예산을 정하면 이번 달부터 저장되고, 비우면 0으로 꺼지며, 잘못된 값은 칸 아래에 이유가 나온다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-budget-page");
  const cafe = (await db.from("categories").select("id").is("group_id", null).eq("name", "카페").single()).data!.id;
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByLabel("메뉴").click();
  await page.getByRole("link", { name: "예산" }).click();

  await page.getByLabel("가족 전체 예산").fill("300,000");
  await page.getByLabel("카페 예산").fill("abc");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("0 이상 숫자로 입력해 주세요.");
  await expect(page.getByLabel("가족 전체 예산")).toHaveValue("300,000");

  await page.getByLabel("카페 예산").fill("50000");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("budget-total")).toContainText("예산 300,000원 중 0%");

  const month = budgetMonth(kstMonthOf(new Date()));
  const rows = async () =>
    (await db.from("budgets").select("category_id, month, amount").eq("group_id", g.groupId).order("amount")).data;
  expect(await rows()).toEqual([
    { category_id: cafe, month, amount: 50000 },
    { category_id: null, month, amount: 300000 },
  ]);

  // 카페 칸을 비우면 0(끔), 나머지 칸은 바뀌지 않았으니 그대로
  await page.goto("/budget");
  await expect(page.getByLabel("카페 예산")).toHaveValue("50,000");
  await page.getByLabel("카페 예산").fill("");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("family-total")).toBeVisible();
  expect(await rows()).toEqual([
    { category_id: cafe, month, amount: 0 },
    { category_id: null, month, amount: 300000 },
  ]);
});

test("열어 둔 예산 화면에서 저장해도 그사이 다른 사람이 바꾼 칸은 덮어쓰지 않는다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-budget-stale");
  const cafe = (await db.from("categories").select("id").is("group_id", null).eq("name", "카페").single()).data!.id;
  const month = budgetMonth(kstMonthOf(new Date()));
  await db.from("budgets").insert({ group_id: g.groupId, category_id: cafe, month, amount: 50000 });
  await signIn(context, g.owner.email);
  await page.goto("/budget");
  await expect(page.getByLabel("카페 예산")).toHaveValue("50,000");

  await db.from("budgets").update({ amount: 70000 }).eq("group_id", g.groupId).eq("category_id", cafe); // 배우자가 변경
  await page.getByLabel("가족 전체 예산").fill("300000");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("family-total")).toBeVisible();
  const { data } = await db.from("budgets").select("amount").eq("group_id", g.groupId).eq("category_id", cafe).single();
  expect(data).toEqual({ amount: 70000 });
});
