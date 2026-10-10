import { expect, test } from "@playwright/test";
import { kstDateKey } from "@/fx/rates";
import { ingestMessage } from "@/ingest/service";
import { FOREIGN_APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { adminClient } from "../tests/helpers/db";
import { at, detailField, kstStamp, openAdd, readyGroupFixture, signIn } from "./support";

const db = adminClient();
/** 오늘 환율: 1 USD = 1,342.2819원 → 8 USD = 10,738원 */
const seedRate = () => db.from("fx_rates").upsert({ date: kstDateKey(new Date()), base: "KRW", rates: { KRW: 1, USD: 0.000745 } });

test("해외 결제는 목록에 '약 …원 · 8 USD', 상세에 환율·출처가 보이고, 금액을 고치면 '약'·'예상'이 사라진다", async ({ page, context }) => {
  await seedRate();
  const g = await readyGroupFixture("e2e-fx");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(FOREIGN_APPROVAL, kstStamp(3)), receivedAt: new Date(), source: "manual_test" });
  expect(r.status).toBe("parsed");
  await signIn(context, g.owner.email);
  await page.goto("/");

  const row = page.locator("li").filter({ hasText: "typesafe a" });
  await expect(row).toContainText("약 10,738원");
  await expect(row.getByTestId("tx-card")).toHaveText("국민카드 · 8 USD");

  await row.click();
  const detail = page.getByRole("dialog", { name: "거래 상세" });
  await expect(detail).toContainText("약 10,738원");
  await expect(detail).toContainText("(예상)");
  await expect(detail).toContainText("8 USD × 1,342.28원");
  await expect(detail).toContainText("환율 제공: ExchangeRate-API");

  await detailField(page, "금액").click();
  const step = page.getByRole("region", { name: "금액 고치기" });
  const input = step.getByLabel("금액");
  await input.fill("");
  await input.pressSequentially("11000");
  await step.getByRole("button", { name: "확인" }).click();
  await expect(detailField(page, "금액")).toContainText("11,000원");
  await expect(detail).not.toContainText("(예상)");
  await expect(detail).not.toContainText("약 ");
  await expect(detail).toContainText("8 USD");
});

test("국내 카드 거래는 상세에서 금액을 고칠 수 없다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-fx-domestic");
  const { APPROVAL } = await import("@/parsers/__fixtures__/kb-card");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(3)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  await expect(detailField(page, "금액")).toBeDisabled();
});

test("붙여넣기: 외화 문자는 결제일 환율로 원화를 채우고 계산 근거를 보여 준다", async ({ page, context }) => {
  await seedRate();
  const g = await readyGroupFixture("e2e-fx-paste");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await openAdd(page);
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /결제문자 붙여넣기/ }).click();
  await add.getByLabel("결제 문자").fill(at(FOREIGN_APPROVAL, kstStamp(3)));
  await add.getByRole("button", { name: "읽기" }).click();
  const stacked = add.getByLabel("입력한 내용");
  await expect(stacked.getByRole("button", { name: /금액/ })).toContainText("1만 738원");
  await expect(add).toContainText("8 USD × 1,342.28원");
  await expect(add).toContainText("환율)로 계산했어요");
});
