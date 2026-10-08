import { expect, test } from "@playwright/test";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient } from "../tests/helpers/db";
import { at, kstStamp, readyGroupFixture, signIn } from "./support";

const db = adminClient();

test("거래 상세에서 온누리상품권 결제로 체크하면 결제 수단만 바뀌고 쓴 돈은 그대로", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-onnuri");
  await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: at(APPROVAL, kstStamp(5)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("tx-card").first()).toHaveText("국민카드");
  const total = await page.getByTestId("family-total").textContent();

  const close = () => page.getByRole("dialog", { name: "거래 상세" }).getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByTestId("tx-row").first().click();
  const check = page.getByRole("checkbox", { name: /온누리상품권으로 결제/ });
  await expect(check).not.toBeChecked();
  await check.check();
  await expect(page.getByTestId("detail-card")).toHaveText("온누리상품권");
  await close();
  await expect(page.getByTestId("tx-card").first()).toHaveText("온누리상품권");
  await expect(page.getByTestId("family-total")).toHaveText(total!);

  await page.getByTestId("tx-row").first().click();
  await page.getByRole("checkbox", { name: /온누리상품권으로 결제/ }).uncheck();
  await expect(page.getByTestId("detail-card")).toHaveText("국민카드");
  await close();
  await expect(page.getByTestId("tx-card").first()).toHaveText("국민카드");
});
