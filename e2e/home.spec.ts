import { expect, test } from "@playwright/test";
import { APPROVAL, APPROVAL_SMALL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture, createLoneUser, type GroupFixture } from "../tests/helpers/db";
import { at, signIn, todayMmdd } from "./support";

const db = adminClient();
const send = (g: GroupFixture, who: "owner" | "member", body: string) =>
  ingestMessage(db, { userId: g[who].userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

test("이번 달 합계·사람별 합계·날짜별 거래와 미분류 줄을 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-home");
  const day = todayMmdd();
  await send(g, "owner", at(APPROVAL, `${day} 00:01`));
  await send(g, "owner", at(APPROVAL, `${day} 00:02`));
  await send(g, "member", at(APPROVAL_SMALL, `${day} 00:03`));
  await send(g, "member", UNKNOWN_KB);

  await signIn(context, g.owner.email);
  await page.goto("/");

  await expect(page.getByTestId("family-total")).toHaveText("가족 25,500원");
  await expect(page.getByText("e2e-home-owner 24,600 · e2e-home-member 900")).toBeVisible();
  await expect(page.getByTestId("tx-row")).toHaveCount(3);
  await expect(page.getByTestId("tx-row").first()).toContainText("지에스(GS)25 테스트점");
  await expect(page.getByTestId("tx-row").first()).toContainText("미지정");
  await expect(page.getByRole("link", { name: /확인할 문자 1건/ })).toBeVisible();

  // 지난달로 가면 거래가 없고, 이번 달 이후로는 갈 수 없다
  await expect(page.getByRole("link", { name: "다음 달" })).toHaveCount(0);
  await page.getByRole("link", { name: "이전 달" }).click();
  await expect(page.getByText("이 달에는 거래가 없습니다")).toBeVisible();
  await expect(page.getByTestId("family-total")).toHaveText("가족 0원");
});

test("다른 그룹의 거래 id를 주소에 넣어도 시트가 열리지 않는다", async ({ page, context }) => {
  const mine = await createGroupFixture("e2e-home-mine");
  const other = await createGroupFixture("e2e-home-other");
  const r = await send(other, "owner", at(APPROVAL, `${todayMmdd()} 00:01`));

  await signIn(context, mine.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  await expect(page.getByTestId("family-total")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("그룹이 없는 사용자는 안내를 본다", async ({ page, context }) => {
  const lone = await createLoneUser("e2e-lone");
  await signIn(context, lone.email);
  await page.goto("/");
  await expect(page.getByText("아직 그룹이 없습니다")).toBeVisible();
});
