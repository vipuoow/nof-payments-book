import { expect, test } from "@playwright/test";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { budgetMonth } from "@/ledger/budget";
import { kstMonthOf, shiftMonth } from "@/ledger/month";
import { adminClient } from "../tests/helpers/db";
import { at, kstStamp, signIn, readyGroupFixture } from "./support";

const db = adminClient();

test("지난달에 정한 전체 예산이 이번 달에도 이어지고, 80% 넘은 카테고리만 경고로 보인다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-budget");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(2)), receivedAt: new Date(), source: "manual_test" });
  const id = async (name: string) =>
    (await db.from("categories").select("id").is("group_id", null).eq("name", name).single()).data!.id;
  const cafe = await id("카페");
  await db.from("transactions").update({ category_id: cafe, category_source: "user" }).eq("id", r.transactionId!);

  const thisMonth = kstMonthOf(new Date());
  await db.from("budgets").insert([
    { group_id: g.groupId, category_id: null, month: budgetMonth(shiftMonth(thisMonth, -1)), amount: 100000 },
    { group_id: g.groupId, category_id: cafe, month: budgetMonth(thisMonth), amount: 10000 },
    { group_id: g.groupId, category_id: await id("식비"), month: budgetMonth(thisMonth), amount: 100000 },
  ]);

  await signIn(context, g.owner.email);
  await page.goto("/");
  // 한도 카드: 남은 돈은 막대 안에 한글 단위로, 사용률 12%는 녹색
  await expect(page.getByTestId("budget-total")).toHaveText("8만 7700원 남음");
  await expect(page.getByText("한도 10만원 중")).toBeVisible();
  await expect(page.locator(".spend")).toHaveAttribute("data-level", "ok");
  await expect(page.getByTestId("budget-category")).toHaveCount(1);
  await expect(page.getByTestId("budget-category")).toHaveText("카페 123% 썼어요 · 2,300원 초과");

  // 지난달: 전체 예산만 있고(카테고리 예산은 이번 달부터) 쓴 돈이 없다
  await page.getByRole("link", { name: "이전 달" }).click();
  await expect(page.getByTestId("budget-total")).toHaveText("10만원 남음");
  await expect(page.getByTestId("budget-category")).toHaveCount(0);
});

test("분류별 예산이 없으면 전체 한도 막대만 있고 분류 경고는 없다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-budget-none");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("family-total")).toBeVisible();
  await expect(page.getByTestId("budget-total")).toHaveCount(1);
  await expect(page.getByTestId("budget-category")).toHaveCount(0);
});

test("숨긴 카테고리의 예산은 홈 경고에 나오지 않는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-budget-hidden");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(2)), receivedAt: new Date(), source: "manual_test" });
  const cafe = (await db.from("categories").select("id").is("group_id", null).eq("name", "카페").single()).data!.id;
  await db.from("transactions").update({ category_id: cafe, category_source: "user" }).eq("id", r.transactionId!);
  await db.from("budgets").insert({ group_id: g.groupId, category_id: cafe, month: budgetMonth(kstMonthOf(new Date())), amount: 10000 });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("budget-category")).toHaveCount(1);
  await db.from("category_hidden").insert({ group_id: g.groupId, category_id: cafe });
  await page.reload();
  await expect(page.getByTestId("family-total")).toBeVisible();
  await expect(page.getByTestId("budget-category")).toHaveCount(0);
});
