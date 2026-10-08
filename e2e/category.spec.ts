import { expect, test } from "@playwright/test";
import { APPROVAL, APPROVAL_SMALL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, type GroupFixture } from "../tests/helpers/db";
import { at, signIn, kstStamp, pickCategory, readyGroupFixture } from "./support";

const db = adminClient();
const send = (g: GroupFixture, body: string) =>
  ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

test("거래를 탭해 카테고리를 고르면 같은 가맹점 거래도 바뀌고 규칙이 저장된다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-cat");
  await send(g, at(APPROVAL, kstStamp(3)));
  await send(g, at(APPROVAL, kstStamp(2)));
  await send(g, at(APPROVAL_SMALL, kstStamp(1)));

  await signIn(context, g.owner.email);
  await page.goto("/");
  const coffee = page.getByTestId("tx-row").filter({ hasText: "테스트커피" });
  await expect(coffee).toHaveCount(2);

  await coffee.first().click();
  await pickCategory(page, "카페");
  await page.getByRole("dialog", { name: "거래 상세" }).getByRole("button", { name: "✕ 닫기" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(coffee.filter({ hasText: "카페" })).toHaveCount(2);
  await expect(page.getByTestId("tx-row").filter({ hasText: "지에스(GS)25" })).toContainText("미지정");

  const { data: rule } = await db.from("merchant_rules").select("category_id, categories(name)")
    .eq("group_id", g.groupId).single();
  expect((rule as unknown as { categories: { name: string } }).categories.name).toBe("카페");
});
