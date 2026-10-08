import { expect, test, type Page } from "@playwright/test";
import { adminClient, createGroupFixture, createLoneUser, makeOperator } from "../tests/helpers/db";
import { signIn } from "./support";

const db = adminClient();
// 테스트 DB에는 다른 테스트가 만든 그룹이 수천 개 쌓여 있어 운영자 화면이 느리다(운영은 최대 30명). 넉넉히 기다린다
test.describe.configure({ timeout: 120_000 });
const slow = { timeout: 30_000 };
test.beforeAll(async () => { await db.from("app_settings").update({ value: 1_000_000 }).eq("key", "max_users"); });
test.afterAll(async () => { await db.from("app_settings").update({ value: 30 }).eq("key", "max_users"); });

async function asOperator(page: Page, context: Parameters<typeof signIn>[0]) {
  const op = await createLoneUser("e2e-op");
  await makeOperator(op.userId);
  await page.addInitScript(() => {
    const w = window as unknown as { __copied?: string };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await signIn(context, op.email);
  await page.goto("/operator");
  return op;
}

test("서비스 초대 링크는 잘 보이는 카드로 나오고, 버튼 하나로 복사한다", async ({ page, context }) => {
  await asOperator(page, context);
  await expect(page.getByRole("heading", { name: "서비스 관리" })).toBeVisible();
  await page.getByRole("button", { name: "서비스 초대 링크 만들기" }).click();
  const link = page.getByTestId("invite-link");
  await expect(link).toHaveText(/\/invite\/[A-Za-z0-9_-]+$/, slow);
  await page.getByRole("button", { name: "링크 복사" }).click();
  await expect(page.getByText("링크를 복사했어요")).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
  expect(copied).toMatch(/같이가계부에 초대해요[\s\S]*\/invite\/[A-Za-z0-9_-]+$/);
});

test("그룹마다 구성원과 연결 상태를 보고, 그룹장 닉네임을 입력해야 그룹을 없앤다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-opg");
  await db.from("ingest_tokens").insert({ user_id: g.owner.userId, token_hash: `opg-${g.groupId}`, label: "t", last_used_at: new Date().toISOString() });
  await asOperator(page, context);
  const card = page.getByTestId(`group-${g.groupId}`);
  await expect(card).toContainText("e2e-opg-owner");
  await expect(card).toContainText("e2e-opg-member");
  await expect(card.getByText("연결됨")).toHaveCount(1);
  await expect(card.getByText("연결 전")).toHaveCount(1);

  await card.getByRole("button", { name: "그룹 없애기" }).click();
  const confirm = card.getByRole("button", { name: "영구 삭제" });
  await expect(confirm).toBeDisabled();
  await card.getByLabel("그룹장 닉네임").fill("틀린이름");
  await expect(confirm).toBeDisabled();
  await card.getByLabel("그룹장 닉네임").fill("e2e-opg-owner");
  await confirm.click();
  await expect(page.getByTestId(`group-${g.groupId}`)).toHaveCount(0, slow);
  // 가계부 없는 계정으로 남는다(휴대폰 연결 표시 포함)
  const left = page.getByTestId(`groupless-${g.owner.userId}`);
  await expect(left).toContainText("휴대폰 연결 있음", slow);
  const { data } = await db.from("profiles").select("can_create_group").eq("user_id", g.owner.userId).single();
  expect(data?.can_create_group).toBe(false);
});

test("가계부 없는 계정은 확인 뒤 지운다", async ({ page, context }) => {
  const lone = await createLoneUser("e2e-op-lone");
  await asOperator(page, context);
  const row = page.getByTestId(`groupless-${lone.userId}`);
  await row.getByRole("button", { name: "계정 지우기" }).click();
  await row.getByRole("button", { name: "정말 지우기" }).click();
  await expect(page.getByTestId(`groupless-${lone.userId}`)).toHaveCount(0, slow);
  const { data } = await db.from("profiles").select("user_id").eq("user_id", lone.userId);
  expect(data).toEqual([]);
});
