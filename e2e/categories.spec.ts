import { expect, test } from "@playwright/test";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture } from "../tests/helpers/db";
import { at, kstStamp, signIn } from "./support";

const db = adminClient();

test("기본 숨기기, 우리 카테고리 추가·이름 바꾸기·삭제가 거래 시트에 반영된다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-cats");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(2)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);
  page.on("dialog", (d) => d.accept());

  await page.goto("/categories");
  await page.getByTestId("default-문화").getByRole("button", { name: "숨기기" }).click();
  await expect(page.getByTestId("default-문화").getByRole("button", { name: "보이기" })).toBeVisible();

  await page.getByLabel("새 카테고리 이름").fill("카페");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("이미 있는 이름입니다.");
  await page.getByLabel("새 카테고리 이름").fill("반려동물");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByTestId("group-category")).toHaveCount(1);

  await page.goto(`/?tx=${r.transactionId}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await expect(sheet.getByRole("button", { name: "문화", exact: true })).toHaveCount(0);
  await sheet.getByRole("button", { name: "반려동물", exact: true }).click();
  await expect(page.getByTestId("tx-row").first()).toContainText("반려동물");

  await page.goto("/categories");
  await page.getByLabel("반려동물 새 이름").fill("펫");
  await page.getByTestId("group-category").getByRole("button", { name: "저장" }).click();
  await expect(page.getByLabel("펫 새 이름")).toBeVisible();

  // 규칙이 생겼고(거래 시트에서 고름), 카테고리를 지우면 거래는 미지정·규칙도 삭제
  await expect(page.getByTestId("rule")).toContainText("펫");
  await page.getByTestId("group-category").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByTestId("group-category")).toHaveCount(0);
  await expect(page.getByTestId("rule")).toHaveCount(0);
  const { data } = await db.from("transactions").select("category_id, category_source").eq("id", r.transactionId!).single();
  expect(data).toEqual({ category_id: null, category_source: null });
});

test("가맹점 규칙을 지울 수 있다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-rules");
  const cafe = (await db.from("categories").select("id").is("group_id", null).eq("name", "카페").single()).data!.id;
  await db.from("merchant_rules").insert({ group_id: g.groupId, merchant_pattern: "테스트커피 강남역점(메가", category_id: cafe });
  await signIn(context, g.owner.email);
  page.on("dialog", (d) => d.accept());
  await page.goto("/categories");
  await expect(page.getByTestId("rule")).toHaveText(/테스트커피 강남역점\(메가\s*→\s*카페/);
  await page.getByTestId("rule").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("거래의 카테고리를 고르면 여기에 규칙이 생깁니다.")).toBeVisible();
});
