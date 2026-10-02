import { expect, test } from "@playwright/test";
import { adminClient, createGroupFixture, issueIngestToken } from "../tests/helpers/db";
import { signIn } from "./support";

const db = adminClient();

test("기종 탭에 따라 안내와 source가 바뀌고, 발급 직후 헤더에 토큰이 들어간다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-devices");
  await signIn(context, g.owner.email);
  await page.goto("/devices");

  await expect(page.getByRole("link", { name: "아이폰" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("단축어 앱을 열고")).toBeVisible();
  await expect(page.getByTestId("copy-body")).toHaveValue(/"source":"ios_shortcut"/);
  await expect(page.getByTestId("copy-url")).toHaveValue(/\/api\/ingest$/);
  await expect(page.getByTestId("copy-header")).toHaveValue("Bearer <토큰>");

  await page.getByRole("link", { name: "갤럭시" }).click();
  await expect(page.getByText("MacroDroid 앱을 설치하고")).toBeVisible();
  await expect(page.getByTestId("copy-body")).toHaveValue(/"source":"android_macrodroid"/);

  await page.getByPlaceholder("기기 이름").fill("내 갤럭시");
  await page.getByRole("button", { name: "토큰 발급" }).click();
  const token = await page.getByTestId("token-value").inputValue();
  expect(token.length).toBeGreaterThan(20);
  await expect(page.getByTestId("copy-header")).toHaveValue(`Bearer ${token}`);

  await page.getByTestId("copy-header").locator("..").getByRole("button", { name: "복사" }).click();
  await expect(page.getByText(/복사됨|길게 눌러 복사해 주세요/)).toBeVisible();
});

test("마지막 수신이 3일 넘은 기기와 받은 적 없는 기기를 알려 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-devices-stale");
  await issueIngestToken(g.owner.userId);
  await db.from("ingest_tokens").update({ last_used_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("user_id", g.owner.userId);
  await issueIngestToken(g.owner.userId);
  await signIn(context, g.owner.email);
  await page.goto("/devices");
  await expect(page.getByText("3일 넘게 문자가 오지 않았습니다. 설정을 확인해 주세요.")).toHaveCount(1);
  await expect(page.getByText("아직 받은 문자가 없습니다.")).toHaveCount(1);
});

test("토큰을 발급한 뒤 기종 탭을 바꿔도 토큰이 사라지지 않는다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-devices-tab");
  await signIn(context, g.owner.email);
  await page.goto("/devices");
  await page.getByRole("button", { name: "토큰 발급" }).click();
  const token = await page.getByTestId("token-value").inputValue();
  await page.getByRole("link", { name: "갤럭시" }).click();
  await expect(page.getByText("MacroDroid 앱을 설치하고")).toBeVisible();
  await expect(page.getByTestId("token-value")).toHaveValue(token);
  await expect(page.getByTestId("copy-header")).toHaveValue(`Bearer ${token}`);
});
