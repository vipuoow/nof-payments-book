import { expect, test } from "@playwright/test";
import { APPROVAL as KB } from "@/parsers/__fixtures__/kb-card";
import { adminClient } from "../tests/helpers/db";
import { openAdd, readyGroupFixture, signIn } from "./support";

const db = adminClient();
/** 국민카드 승인 문자를 지금으로부터 minutesAgo분 전 시각으로 */
const kbAt = (minutesAgo: number) => {
  const k = new Date(Date.now() - minutesAgo * 60_000 + 9 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return KB.replace("09/23 08:26", `${p(k.getUTCMonth() + 1)}/${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`);
};

test("+를 누르면 같은 버튼이 늘어나 '결제 직접 입력'이 되고(×는 따로 없음), 3초 뒤 다시 +로 돌아온다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-menu");
  await signIn(context, g.owner.email);
  await page.goto("/");
  const menu = page.locator(".add-menu");
  const plus = page.getByRole("button", { name: "결제 입력 메뉴" });
  await expect(menu.getByRole("button")).toHaveCount(1);
  await plus.click();
  const open = page.getByRole("button", { name: "결제 직접 입력" });
  await expect(open).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("button")).toHaveCount(1); // 같은 버튼이 모양만 바뀐다
  await expect(menu).not.toContainText("×");
  await page.waitForTimeout(3300);
  await expect(plus).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "결제 직접 입력" })).toHaveCount(0);

  // 바깥을 누르면 바로 돌아온다
  await plus.click();
  await expect(page.getByRole("button", { name: "결제 직접 입력" })).toBeVisible();
  await page.locator(".spend-card").click({ position: { x: 20, y: 60 } });
  await expect(plus).toHaveAttribute("aria-expanded", "false");
});

test("펼친 버튼을 누르면 그 자리에서 새로 추가가 커지고, 닫은 뒤 +를 다시 누르면 다시 늘어난다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-menu-open");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.locator("[data-add-button]")).toHaveCount(1); // 새로 추가가 커지는 자리
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  await page.getByRole("button", { name: "결제 직접 입력" }).click();
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await expect(add).toBeVisible();
  await page.waitForTimeout(3300); // 남은 타이머가 있어도 문제없다
  await add.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "결제 입력 메뉴" })).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  await expect(page.getByRole("button", { name: "결제 직접 입력" })).toBeVisible();
});

test("문자 붙여넣기: 규칙 있는 가게면 마지막 화면까지 채워지고, 저장하면 목록에 나온다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-paste");
  const cafe = (await db.from("categories").select("id").eq("name", "카페").is("group_id", null).single()).data!.id;
  await db.from("merchant_rules").insert({ group_id: g.groupId, merchant_pattern: "테스트커피 강남역점(메가", category_id: cafe });
  await signIn(context, g.owner.email);
  await page.goto("/");
  await openAdd(page);
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await expect(add.getByRole("heading", { name: "어떻게 적을까요?" })).toBeVisible();
  await add.getByRole("button", { name: /결제문자 붙여넣기/ }).click();
  await add.getByLabel("결제 문자").fill(kbAt(3));
  await add.getByRole("button", { name: "읽기" }).click();
  await expect(add.getByRole("heading", { name: "다 입력했어요" })).toBeVisible();
  const stacked = add.getByLabel("입력한 내용");
  await expect(stacked.getByRole("button", { name: /금액/ })).toContainText("1만 2300원");
  await expect(stacked.getByRole("button", { name: /어디서/ })).toContainText("테스트커피 강남역점(메가");
  await expect(stacked.getByRole("button", { name: /분류/ })).toContainText("카페");
  await expect(stacked.getByRole("button", { name: /누가/ })).toContainText("e2e-paste-owner");
  await add.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("tx-row").filter({ hasText: "테스트커피" })).toContainText("카페");
});

test("규칙이 없는 가게는 분류만 묻는다. 같은 결제가 있으면 경고하고 [그래도 저장]으로 저장한다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-paste-overlap");
  await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 12300, merchant: "먼저 적은 커피",
    occurred_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  });
  await signIn(context, g.owner.email);
  await page.goto("/?add=1");
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /결제문자 붙여넣기/ }).click();
  await add.getByLabel("결제 문자").fill(kbAt(3));
  await add.getByRole("button", { name: "읽기" }).click();
  await add.getByRole("button", { name: "식비", exact: true }).click();
  await add.getByRole("button", { name: "다 입력했어요" }).click();
  await add.getByRole("button", { name: "저장하기" }).click();
  await expect(add.getByRole("alert")).toContainText("이미 들어온 결제 같아요");
  await expect(add.getByRole("alert")).toContainText("먼저 적은 커피");
  await add.getByRole("button", { name: "그래도 저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("tx-row").filter({ hasText: "테스트커피" })).toBeVisible();
});

test("금액 없는 글·취소 문자·빈 칸은 안내하고, 금액만 있으면 빠진 것만 묻는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-paste-errors");
  await signIn(context, g.owner.email);
  await page.goto("/?add=1");
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /결제문자 붙여넣기/ }).click();
  const box = add.getByLabel("결제 문자");
  await add.getByRole("button", { name: "읽기" }).click();
  await expect(add.getByRole("alert")).toHaveText("결제 문자를 붙여 넣어 주세요.");
  await box.fill("안녕하세요 광고입니다");
  await add.getByRole("button", { name: "읽기" }).click();
  await expect(add.getByRole("alert")).toHaveText("결제 금액을 찾지 못했어요. 문자를 확인하거나 직접 적어 주세요.");
  await box.fill(kbAt(3).replace("승인", "취소"));
  await add.getByRole("button", { name: "읽기" }).click();
  await expect(add.getByRole("alert")).toHaveText("취소 문자예요. 원래 결제를 찾아 지워 주세요.");
  // 금액만 있는 글: 어디서부터 묻는다
  await box.fill("편의점 3,000원 결제");
  await add.getByRole("button", { name: "읽기" }).click();
  await expect(add.getByLabel("입력한 내용").getByRole("button", { name: /금액/ })).toContainText("3000원");
  await expect(add.getByRole("textbox")).toBeVisible(); // 어디서
});

test("다듬기(10/09): 붙여넣기 화면엔 [붙여넣기] 버튼이 없고, 질문은 '썼나요?', 날짜는 YY/MM/DD, 뒤로 아이콘은 크게", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-polish-1009");
  await signIn(context, g.owner.email);
  await page.goto("/");
  // 펼친 버튼은 조금 작게(높이 36px 이하)
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  const open = page.getByRole("button", { name: "결제 직접 입력" });
  await expect(open).toBeVisible();
  await page.waitForTimeout(600);
  expect((await open.boundingBox())!.height).toBeLessThanOrEqual(36);
  await open.click();
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /결제문자 붙여넣기/ }).click();
  await expect(add.getByLabel("결제 문자")).toBeVisible();
  await expect(add.getByRole("button", { name: "붙여넣기", exact: true })).toHaveCount(0);
  const back = add.getByRole("button", { name: "뒤로" });
  expect((await back.locator("svg").boundingBox())!.width).toBeGreaterThanOrEqual(24);
  await back.click();
  await add.getByRole("button", { name: /직접 입력/ }).click();
  await expect(add.getByRole("heading", { name: "얼마 썼나요?" })).toBeVisible();
  await add.getByLabel("금액").pressSequentially("5000");
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("heading", { name: "어디서 썼나요?" })).toBeVisible();
  await add.getByRole("textbox").fill("시장");
  await add.getByRole("textbox").press("Enter");
  await add.getByRole("button", { name: "식비", exact: true }).click();
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("heading", { name: "언제 썼나요?" })).toBeVisible();
  const k = new Date(Date.now() + 9 * 3600_000).toISOString();
  const yymmdd = `${k.slice(2, 4)}/${k.slice(5, 7)}/${k.slice(8, 10)}`;
  await expect(add.getByTestId("when-date")).toHaveText(yymmdd);
});

test("분기에서 직접 입력는 지금 흐름으로 간다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-paste-direct");
  await signIn(context, g.owner.email);
  await page.goto("/?add=1");
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /직접 입력/ }).click();
  await expect(add.getByLabel("금액")).toBeVisible();
});

test("검토 반영: [그래도 저장]을 저장 직후 한 번 더 눌러도 한 번만 저장된다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-paste-force-twice");
  await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 12300, merchant: "먼저 적은 커피",
    occurred_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  });
  await signIn(context, g.owner.email);
  await page.goto("/?add=1");
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /결제문자 붙여넣기/ }).click();
  await add.getByLabel("결제 문자").fill(kbAt(3));
  await add.getByRole("button", { name: "읽기" }).click();
  await add.getByRole("button", { name: "식비", exact: true }).click();
  await add.getByRole("button", { name: "다 입력했어요" }).click();
  await add.getByRole("button", { name: "저장하기" }).click();
  await expect(add.getByRole("alert")).toContainText("이미 들어온 결제 같아요");
  // 저장 뒤 그 달로 옮겨 가는 화면 전환을 늦춰, 체크 표시가 남은 버튼을 한 번 더 누른다
  await page.route(/\/\?month=/, async (r) => { if (r.request().headers()["rsc"]) await new Promise((res) => setTimeout(res, 2500)); await r.continue(); });
  const force = add.locator(".check-btn");
  await force.click();
  await expect.poll(async () => (await db.from("transactions").select("id").eq("group_id", g.groupId).eq("merchant", "테스트커피 강남역점(메가")).data?.length).toBe(1);
  await force.click({ force: true });
  await page.waitForTimeout(1500);
  expect((await db.from("transactions").select("id").eq("group_id", g.groupId).eq("merchant", "테스트커피 강남역점(메가")).data).toHaveLength(1);
});

test("검토 반영: 키보드로 펼치면 버튼에 머무는 동안 접히지 않고, 벗어나면 접힌다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-menu-focus");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("button", { name: "결제 입력 메뉴" }).focus();
  await page.keyboard.press("Enter");
  const open = page.getByRole("button", { name: "결제 직접 입력" });
  await expect(open).toBeVisible();
  await page.waitForTimeout(3300);
  await expect(open).toBeVisible();
  await page.getByLabel("메뉴", { exact: true }).focus();
  await expect(open).toHaveCount(0);
});

test("움직임 다듬기: 펼친 버튼 아래 3초 줄, 누르면 ✓ 체크 뒤 열림, 분기는 좌우로 놓이고 고르면 ✓ 체크", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-motion");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  await expect(page.locator(".add-fab-timer")).toBeVisible();
  const open = page.getByRole("button", { name: "결제 직접 입력" });
  await open.click();
  await expect(page.locator("[data-add-button]")).toHaveAttribute("aria-busy", "true");
  const add = page.getByRole("dialog", { name: "새로 추가" });
  const paste = add.getByRole("button", { name: /결제문자 붙여넣기/ });
  const direct = add.getByRole("button", { name: /직접 입력/ });
  const [a, b] = [(await paste.boundingBox())!, (await direct.boundingBox())!];
  expect(Math.abs(a.y - b.y)).toBeLessThan(2); // 같은 줄
  expect(b.x).toBeGreaterThan(a.x + a.width - 1); // 오른쪽
  // 질문은 화면 가운데, 카드 이름은 '결제문자 붙여넣기 / 직접 입력'
  const q = add.getByRole("heading", { name: "어떻게 적을까요?" });
  expect(await q.evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");
  const qb = (await q.boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(Math.abs(qb.x + qb.width / 2 - vw / 2)).toBeLessThan(4);
  await expect(paste).toContainText("결제문자 붙여넣기");
  await expect(direct).toContainText("직접 입력");
  await paste.click();
  await expect(paste).toHaveAttribute("aria-busy", "true");
  await expect(add.getByLabel("결제 문자")).toBeVisible();
});
