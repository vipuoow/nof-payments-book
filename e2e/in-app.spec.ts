import { expect, test, type Browser } from "@playwright/test";
import { createGroupFixture } from "../tests/helpers/db";
import { signIn } from "./support";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const KAKAO = `${IPHONE} KAKAOTALK 25.8.0`;
const NAVER = `${IPHONE} NAVER(inapp; search; 1000; 12.0.0)`;

const contextWith = (browser: Browser, userAgent: string) => browser.newContext({ ...test.info().project.use, userAgent });

test("카카오톡 안에서 처음 화면을 열면 Safari로 여는 버튼을 보여 준다", async ({ browser }) => {
  const ctx = await contextWith(browser, KAKAO);
  const page = await ctx.newPage();
  await page.goto("/login");
  await expect(page.getByText("카카오톡 안에서 열려 있어요")).toBeVisible();
  const open = page.getByRole("link", { name: "Safari로 열기" });
  await expect(open).toHaveAttribute("href", /^kakaotalk:\/\/web\/openExternal\?url=https?%3A%2F%2F[^&]+%2Flogin$/);
  await ctx.close();
});

test("카카오톡 안에서 휴대폰 연결 안내를 열어도 같은 안내", async ({ browser }) => {
  const g = await createGroupFixture("e2e-inapp-devices");
  const ctx = await contextWith(browser, KAKAO);
  await signIn(ctx, g.member.email);
  const page = await ctx.newPage();
  await page.goto("/devices");
  await expect(page.getByText("카카오톡 안에서 열려 있어요")).toBeVisible();
  await expect(page.getByText(/단축어 추가가 안 될 수 있어요/)).toBeVisible();
  await ctx.close();
});

test("바로 넘기는 방법이 없는 앱은 메뉴 안내와 주소 복사", async ({ browser }) => {
  const ctx = await contextWith(browser, NAVER);
  const page = await ctx.newPage();
  await page.goto("/login");
  await expect(page.getByText("네이버 안에서 열려 있어요")).toBeVisible();
  await expect(page.getByRole("link", { name: "Safari로 열기" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "주소 복사" })).toBeVisible();
  // 안내가 길어도 제목을 가리지 않는다
  const note = await page.getByRole("note").boundingBox();
  const title = await page.getByRole("heading", { name: "같이가계부" }).boundingBox();
  expect(note!.y + note!.height).toBeLessThanOrEqual(title!.y);
  await ctx.close();
});

test("갤럭시 카카오톡에서는 Safari 대신 기본 브라우저로 안내", async ({ browser }) => {
  const ctx = await contextWith(browser, "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK 10.8.0");
  const page = await ctx.newPage();
  await page.goto("/login");
  await expect(page.getByText(/기본 브라우저에서 열어 주세요/)).toBeVisible();
  await expect(page.getByRole("link", { name: "기본 브라우저로 열기" })).toBeVisible();
  await expect(page.getByText(/Safari/)).toHaveCount(0);
  await ctx.close();
});

test("일반 브라우저에서는 안내가 없다", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "같이가계부" })).toBeVisible();
  await expect(page.getByText(/안에서 열려 있어요/)).toHaveCount(0);
});
