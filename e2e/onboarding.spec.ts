import { expect, test, type Page } from "@playwright/test";
import { adminClient, createAuthOnlyUser, createLoneUser } from "../tests/helpers/db";
import { signIn } from "./support";

const db = adminClient();

// 테스트 DB에는 다른 테스트가 만든 프로필이 쌓여 있으므로 이 파일 동안만 서비스 인원 제한을 넉넉히 둔다
test.beforeAll(async () => { await db.from("app_settings").update({ value: 1_000_000 }).eq("key", "max_users"); });
test.afterAll(async () => { await db.from("app_settings").update({ value: 30 }).eq("key", "max_users"); });

/** 서비스 초대를 받은(가계부를 만들 수 있는) 사용자 */
async function creator(label: string) {
  const u = await createLoneUser(label);
  await db.from("profiles").update({ can_create_group: true }).eq("user_id", u.userId);
  return u;
}

/** 휴대폰 공유 창을 흉내 낸다: 성공하면 보낸 글을 window.__shared에 남긴다. mode="none"이면 공유 창이 없는 브라우저 */
async function fakeShare(page: Page, mode: "ok" | "none") {
  await page.addInitScript((m) => {
    const w = window as unknown as { __shared?: string; __copied?: string };
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: m === "ok" ? async (d: { text: string }) => { w.__shared = d.text; } : undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (t: string) => { w.__copied = t; } },
    });
  }, mode);
}

async function makeAndInvite(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /님, 반가워요/ })).toBeVisible();
  await page.getByLabel("내 닉네임").fill("남편");
  await page.getByRole("button", { name: "가계부 만들기" }).click();
  await expect(page).toHaveURL(/\/partner\?first=1$/);
  await page.getByLabel("초대할 가족의 닉네임").fill("아내");
  await page.getByRole("button", { name: "초대 링크 만들기" }).click();
}

test("닉네임을 정해 가계부를 만들고, 공유 창으로 초대를 보낸다", async ({ page, context }) => {
  const u = await creator("e2e-onb-owner");
  await fakeShare(page, "ok");
  await signIn(context, u.email);
  await makeAndInvite(page);

  await expect(page.getByRole("heading", { name: "초대를 보냈어요" })).toBeVisible();
  await expect(page.getByText("아내님 초대를 기다리는 중")).toBeVisible();
  const shared = await page.evaluate(() => (window as unknown as { __shared?: string }).__shared);
  expect(shared).toMatch(/^남편님이 같이가계부에 초대했어요\. [^\n]*\n\S*\/invite\/[A-Za-z0-9_-]+$/);

  // 메뉴로 다시 들어와도 기다리는 중으로 보인다
  await page.goto("/partner");
  await expect(page.getByText("아내님 초대를 기다리는 중")).toBeVisible();
});

test("공유 창이 없으면 링크를 복사한다", async ({ page, context }) => {
  const u = await creator("e2e-onb-copy");
  await fakeShare(page, "none");
  await signIn(context, u.email);
  await makeAndInvite(page);

  await expect(page.getByText("링크를 복사했어요")).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
  expect(copied).toMatch(/\/invite\/[A-Za-z0-9_-]+$/);
});

test("초대받은 사람은 이름 입력 없이 그룹장이 정한 닉네임으로 들어온다", async ({ page, context, browser }) => {
  const u = await creator("e2e-onb-host");
  await fakeShare(page, "ok");
  await signIn(context, u.email);
  await makeAndInvite(page);
  await expect(page.getByRole("heading", { name: "초대를 보냈어요" })).toBeVisible();
  const shared = (await page.evaluate(() => (window as unknown as { __shared?: string }).__shared))!;
  const url = new URL(shared.split("\n").pop()!);

  const guestCtx = await browser.newContext({ ...test.info().project.use });
  const guest = await createAuthOnlyUser("e2e-onb-guest");
  await signIn(guestCtx, guest.email);
  const gp = await guestCtx.newPage();
  await gp.goto(url.pathname);
  await expect(gp.getByRole("heading", { name: /‘아내’로 함께 써요/ })).toBeVisible();
  await expect(gp.getByText("닉네임은 남편님이 정했어요.")).toBeVisible();
  await expect(gp.getByRole("textbox")).toHaveCount(0);
  await gp.getByRole("button", { name: "시작하기" }).click();
  await expect(gp).toHaveURL(/\/$/);
  const { data } = await db.from("profiles").select("display_name").eq("user_id", guest.userId).single();
  expect(data?.display_name).toBe("아내");

  // 파트너가 들어오면 그룹장 메뉴에서 "파트너 잡으러 가기"가 사라진다
  await page.goto("/");
  await page.getByLabel("메뉴", { exact: true }).click();
  await expect(page.getByRole("link", { name: "내 휴대폰 연결", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "파트너 잡으러 가기" })).toHaveCount(0);
  await guestCtx.close();
});
