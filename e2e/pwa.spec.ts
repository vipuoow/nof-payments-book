import { expect, test } from "@playwright/test";
import { createGroupFixture } from "../tests/helpers/db";
import { signIn } from "./support";

test("매니페스트와 아이콘은 로그인 없이 받는다", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(await manifest.json()).toMatchObject({ short_name: "같이가계부", display: "standalone", start_url: "/" });

  const icon = await request.get("/apple-icon");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
});

test("홈에 PWA 메타와 시스템 글꼴이 적용된다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-pwa");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "같이가계부");
  await expect(page).toHaveTitle("같이가계부");
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain("-apple-system");
});
