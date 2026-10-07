import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// 개발 서버는 MEDIA_DIR이 없으면 저장소의 media/ 폴더를 쓴다(git에는 올리지 않는다)
const dir = join(process.cwd(), "media");
const video = join(dir, "landing.mp4");
let created = false;

test.beforeAll(() => {
  mkdirSync(dir, { recursive: true });
  if (!existsSync(video)) {
    writeFileSync(video, Buffer.alloc(4096, 1));
    created = true;
  }
});
test.afterAll(() => { if (created) rmSync(video); });

test("영상은 로그인 없이 받고, 부분 요청(Range)에 206으로 답한다", async ({ request }) => {
  const res = await request.get("/media/landing.mp4", { headers: { Range: "bytes=0-99" }, maxRedirects: 0 });
  expect(res.status()).toBe(206);
  expect(res.headers()["content-range"]).toMatch(/^bytes 0-99\/\d+$/);
  expect((await res.body()).length).toBe(100);
  expect(res.headers()["content-type"]).toBe("video/mp4");
});

test("정해진 이름이 아니면 404, 범위 밖은 416", async ({ request }) => {
  expect((await request.get("/media/secret.txt", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/media/..%2F.env", { maxRedirects: 0 })).status()).toBe(404);
  const res = await request.get("/media/landing.mp4", { headers: { Range: "bytes=99999999-" }, maxRedirects: 0 });
  expect(res.status()).toBe(416);
});

test("처음 화면: 영상 위에 제목·부제·Google 버튼", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "같이가계부" })).toBeVisible();
  await expect(page.getByText("카드만 써, 기록은 내가 할게")).toBeVisible();
  await expect(page.getByRole("button", { name: /Google로 시작하기/ })).toBeVisible();
  await expect(page.locator("video")).not.toHaveCount(0);
});

test("영상 파일이 없어도 처음 화면은 그대로 쓸 수 있다", async ({ page }) => {
  const moved = `${video}.bak`;
  renameSync(video, moved);
  try {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "같이가계부" })).toBeVisible();
    await expect(page.locator("video")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Google로 시작하기/ })).toBeVisible();
  } finally {
    renameSync(moved, video);
  }
});
