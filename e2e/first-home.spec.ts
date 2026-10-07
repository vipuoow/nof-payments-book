import { expect, test } from "@playwright/test";
import { budgetMonth } from "@/ledger/budget";
import { kstMonthOf, shiftMonth } from "@/ledger/month";
import { adminClient, createGroupFixture, type GroupFixture } from "../tests/helpers/db";
import { signIn } from "./support";

const db = adminClient();
const connect = (g: GroupFixture, who: "owner" | "member") =>
  db.from("ingest_tokens").insert({
    user_id: g[who].userId, token_hash: `fh-${who}-${g.groupId}`, label: "t", last_used_at: new Date().toISOString(),
  });
const thisMonth = () => budgetMonth(kstMonthOf(new Date()));

test("아무도 연결 전이면 홈 대신 휴대폰 연결 안내", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-fh-connect");
  await signIn(context, g.member.email);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "내 휴대폰을 연결해 주세요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "내 휴대폰 연결하기" })).toHaveAttribute("href", "/devices");
  await expect(page.getByTestId("family-total")).toHaveCount(0);
});

test("한 명이 연결되면 한도를 꼭 정하고, 결제가 없으면 응원 문구", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-fh-limit");
  await connect(g, "owner");
  await signIn(context, g.member.email);
  await page.goto("/");
  await expect(page.getByText(/e2e-fh-limit-owner님 휴대폰이 연결됐어요/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /이번 달은 얼마까지/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /나중에/ })).toHaveCount(0);

  await page.getByRole("button", { name: "250만" }).click();
  await expect(page.getByLabel("한 달 한도")).toHaveValue("2,500,000");
  await page.getByRole("button", { name: "이 한도로 시작하기" }).click();
  await expect(page.getByText("잘하고 있어요!")).toBeVisible();
  const { data } = await db.from("budgets").select("month, amount").eq("group_id", g.groupId).is("category_id", null);
  expect(data).toEqual([{ month: thisMonth(), amount: 2_500_000 }]);
});

test("파트너만 연결됐으면 내 홈 위에 연결 전 알림", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-fh-banner");
  await connect(g, "member");
  await db.from("budgets").insert({ group_id: g.groupId, category_id: null, month: thisMonth(), amount: 1_000_000 });
  await signIn(context, g.owner.email);
  await page.goto("/");
  const banner = page.getByRole("link", { name: /내 휴대폰은 아직 연결 전이에요/ });
  await expect(banner).toHaveAttribute("href", "/devices");
});

test("한도를 다음 달부터 바꾸면 이번 달 한도는 그대로", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-fh-change");
  await connect(g, "owner");
  const last = budgetMonth(shiftMonth(kstMonthOf(new Date()), -1));
  await db.from("budgets").insert({ group_id: g.groupId, category_id: null, month: last, amount: 2_500_000 });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByLabel("메뉴").click();
  await page.getByRole("link", { name: "한도" }).click();
  await expect(page.getByText("지금 한도 2,500,000원")).toBeVisible();
  await page.getByLabel("새 한도", { exact: true }).fill("3,000,000");
  await page.getByLabel(/다음 달부터/).check();
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page).toHaveURL(/\/$/);

  const { data } = await db.from("budgets").select("month, amount").eq("group_id", g.groupId).is("category_id", null).order("month");
  expect(data).toEqual([
    { month: last, amount: 2_500_000 },
    { month: thisMonth(), amount: 2_500_000 },
    { month: budgetMonth(shiftMonth(kstMonthOf(new Date()), 1)), amount: 3_000_000 },
  ]);
});

test("한도 화면은 지난 달을 고를 수 없고, 잘못된 값은 이유를 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-fh-bad");
  await connect(g, "owner");
  await signIn(context, g.owner.email);
  await page.goto("/limit");
  await expect(page.getByText("지난 달 한도는 바뀌지 않아요.")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await page.getByLabel("새 한도", { exact: true }).fill("abc");
  await page.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});
