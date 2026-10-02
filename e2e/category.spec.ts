import { expect, test } from "@playwright/test";
import { APPROVAL, APPROVAL_SMALL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture, type GroupFixture } from "../tests/helpers/db";
import { at, signIn, todayMmdd } from "./support";

const db = adminClient();
const send = (g: GroupFixture, body: string) =>
  ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

test("거래를 탭해 카테고리를 고르면 같은 가맹점 거래도 바뀌고 규칙이 저장된다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-cat");
  const day = todayMmdd();
  await send(g, at(APPROVAL, `${day} 00:01`));
  await send(g, at(APPROVAL, `${day} 00:02`));
  await send(g, at(APPROVAL_SMALL, `${day} 00:03`));

  await signIn(context, g.owner.email);
  await page.goto("/");
  const coffee = page.getByTestId("tx-row").filter({ hasText: "테스트커피" });
  await expect(coffee).toHaveCount(2);

  await coffee.first().click();
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "카페", exact: true }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(coffee.filter({ hasText: "카페" })).toHaveCount(2);
  await expect(page.getByTestId("tx-row").filter({ hasText: "지에스(GS)25" })).toContainText("미지정");

  const { data: rule } = await db.from("merchant_rules").select("category_id, categories(name)")
    .eq("group_id", g.groupId).single();
  expect((rule as unknown as { categories: { name: string } }).categories.name).toBe("카페");
});

test("더 보기에서 메모·금액을 고치고, 잘못된 금액은 이유를 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-edit");
  const r = await send(g, at(APPROVAL, `${todayMmdd()} 00:01`));

  await signIn(context, g.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await sheet.getByText("더 보기").click();
  await sheet.getByLabel("금액").fill("0");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("금액은 1원 이상 숫자로 입력해 주세요.");

  await sheet.getByLabel("금액").fill("15,000");
  await sheet.getByLabel("메모").fill("회의 간식");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("family-total")).toHaveText("가족 15,000원");

  const { data } = await db.from("transactions").select("amount, memo").eq("id", r.transactionId!).single();
  expect(data).toEqual({ amount: 15000, memo: "회의 간식" });
});

test("문자에서 온 거래는 삭제 버튼이 없고 원문을 볼 수 있다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-raw");
  const r = await send(g, at(APPROVAL, `${todayMmdd()} 00:01`));
  await signIn(context, g.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await sheet.getByText("더 보기").click();
  await expect(sheet.getByRole("button", { name: "삭제" })).toHaveCount(0);
  await sheet.getByText("원문 보기").click();
  await expect(sheet.getByText("KB국민카드")).toBeVisible();
  await expect(sheet.getByText("1234승인")).toHaveCount(0); // 카드번호는 마스킹돼 있다
});
