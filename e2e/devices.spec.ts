import { expect, test, type Page } from "@playwright/test";
import { adminClient, createGroupFixture, issueIngestToken } from "../tests/helpers/db";
import { IOS_SHORTCUT_PATH } from "../src/ledger/devices";
import { sha256Hex } from "../src/lib/hash";
import { signIn } from "./support";

const db = adminClient();
const next = (page: Page) => page.getByRole("button", { name: "다 했어요" }).click();

test("아이폰: 카드 고르기부터 연결 확인까지 한 화면에 한 단계씩", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-guide-ios");
  await signIn(context, g.owner.email);
  await page.goto("/devices");

  await expect(page.getByRole("heading", { name: "아이폰으로 연결할게요" })).toBeVisible();
  await expect(page.getByText("1 / 7")).toBeVisible();
  await expect(page.getByLabel("KB국민카드")).toBeChecked();
  await page.getByLabel("현대카드").uncheck();
  await page.getByRole("button", { name: "시작하기" }).click();

  await expect(page.getByRole("heading", { name: "연결 코드를 복사해요" })).toBeVisible();
  await page.getByRole("button", { name: "연결 코드 만들기" }).click();
  const token = await page.getByTestId("token-value").inputValue();
  expect(token.length).toBeGreaterThan(20);
  await expect(page.getByTestId("copy-code")).toHaveValue(new RegExp(`/api/ingest ${token}$`));
  await next(page);

  await expect(page.getByRole("link", { name: "단축어 받기" })).toHaveAttribute("href", IOS_SHORTCUT_PATH);
  await next(page);
  await expect(page.getByRole("heading", { name: "연결 코드를 붙여넣어요" })).toBeVisible();
  await expect(page.getByTestId("copy-code")).toHaveValue(new RegExp(`/api/ingest ${token}$`));
  await next(page);
  await expect(page.getByRole("heading", { name: "자동화를 만들어요" })).toBeVisible();
  await next(page);

  await expect(page.getByRole("heading", { name: "카드 문자를 고르세요" })).toBeVisible();
  await expect(page.getByTestId("copy-kb")).toHaveValue("KB국민카드");
  await expect(page.getByTestId("copy-hyundai")).toHaveCount(0); // 현대카드는 고르지 않았다
  await next(page);

  await expect(page.getByRole("heading", { name: "연결을 확인해요" })).toBeVisible();
  await expect(page.getByText("연결 확인 중")).toBeVisible();
  await db.from("ingest_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", sha256Hex(token));
  await expect(page.getByText("연결됐어요!")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("link", { name: "홈으로" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("갤럭시: 주소·헤더·보낼 내용에 발급한 토큰이 들어간다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-guide-android");
  await signIn(context, g.owner.email);
  await page.goto("/devices");
  await page.getByRole("link", { name: "갤럭시 안내로 바꾸기" }).click();
  await expect(page.getByRole("heading", { name: "갤럭시로 연결할게요" })).toBeVisible();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByRole("link", { name: "Play 스토어 열기" })).toHaveAttribute("href", /play\.google\.com/);
  await next(page);
  await expect(page.getByTestId("copy-kb")).toHaveValue("KB국민카드");
  await expect(page.getByTestId("copy-hyundai")).toHaveValue("현대");
  await next(page);

  await page.getByRole("button", { name: "연결 코드 만들기" }).click();
  const token = await page.getByTestId("token-value").inputValue();
  await expect(page.getByTestId("copy-url")).toHaveValue(/\/api\/ingest$/);
  await expect(page.getByTestId("copy-header")).toHaveValue(`Bearer ${token}`);
  await expect(page.getByTestId("copy-body")).toHaveValue(/"source":"android_macrodroid"/);
});

test("단축어 파일은 로그인 없이 받을 수 있다", async ({ request }) => {
  const res = await request.get(IOS_SHORTCUT_PATH, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect((await res.body()).length).toBeGreaterThan(1000);
});

test("마지막 수신이 3일 넘은 기기와 받은 적 없는 기기를 알려 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-devices-stale");
  await issueIngestToken(g.owner.userId);
  await db.from("ingest_tokens").update({ last_used_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("user_id", g.owner.userId);
  await issueIngestToken(g.owner.userId);
  await signIn(context, g.owner.email);
  await page.goto("/devices");
  await expect(page.getByText("3일 넘게 문자가 오지 않았어요. 설정을 확인해 주세요.")).toHaveCount(1);
  await expect(page.getByText("아직 받은 문자가 없어요.")).toHaveCount(1);
});

test("연결 상태는 로그인한 사람만 볼 수 있다", async ({ request }) => {
  const res = await request.get("/api/connection", { maxRedirects: 0 });
  expect([307, 401]).toContain(res.status());
});
