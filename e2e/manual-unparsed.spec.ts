import { expect, test } from "@playwright/test";
import { UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, type GroupFixture } from "../tests/helpers/db";
import { signIn, readyGroupFixture } from "./support";

const db = adminClient();
const send = (g: GroupFixture, body: string) =>
  ingestMessage(db, { userId: g.member.userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

test("+로 직접 입력하면 홈에 나타나고, 잘못된 입력은 이유를 보여 준다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-new");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("link", { name: "직접 입력" }).click();

  await page.getByLabel("금액").fill("abc");
  await page.getByLabel("가맹점").fill("동네 시장");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("금액은 1원 이상 숫자로 입력해 주세요.");

  await page.getByLabel("금액").fill("8,000");
  await page.getByLabel("카테고리").selectOption({ label: "식비" });
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByTestId("family-total")).toHaveText("가족 8,000원");
  const row = page.getByTestId("tx-row").filter({ hasText: "동네 시장" });
  await expect(row).toContainText("식비");
  await expect(row).toContainText("e2e-new-owner");

  // 수동 입력 거래는 시트에서 삭제할 수 있다
  page.on("dialog", (d) => d.accept());
  await row.click();
  await page.getByRole("dialog", { name: "거래 수정" }).getByText("더 보기").click();
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByTestId("tx-row")).toHaveCount(0);
});

test("미분류 문자를 거래로 등록하면 목록과 홈의 확인 줄에서 사라진다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-unparsed");
  await send(g, UNKNOWN_KB);
  await send(g, `${UNKNOWN_KB}\n두 번째`);

  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("link", { name: /확인할 문자 2건/ }).click();
  await expect(page.getByTestId("raw-item")).toHaveCount(2);

  await page.getByTestId("raw-item").filter({ hasText: "두 번째" }).getByRole("button", { name: "무시" }).click();
  await expect(page.getByTestId("raw-item")).toHaveCount(1);

  await page.getByRole("link", { name: "거래로 등록" }).click();
  await expect(page.getByText("결제금액 안내")).toBeVisible();
  await expect(page.getByLabel("사람")).toHaveValue(g.member.userId);
  await page.getByLabel("금액").fill("1,234,567");
  await page.getByLabel("가맹점").fill("국민카드 결제");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByTestId("tx-row").filter({ hasText: "국민카드 결제" })).toBeVisible();
  await expect(page.getByRole("link", { name: /확인할 문자/ })).toHaveCount(0);
  await page.goto("/unparsed");
  await expect(page.getByText("확인할 문자가 없습니다")).toBeVisible();
});
