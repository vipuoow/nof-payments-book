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

test("+를 누르면 '결제 직접 입력'이 펼쳐지고, 3초 뒤 + 하나만 남는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-menu");
  await signIn(context, g.owner.email);
  await page.goto("/");
  const plus = page.getByRole("button", { name: "결제 입력 메뉴" });
  const pill = page.getByRole("link", { name: "결제 직접 입력" });
  await expect(pill).toHaveCount(0);
  await plus.click();
  await expect(plus).toHaveAttribute("aria-expanded", "true");
  await expect(pill).toBeVisible();
  await page.waitForTimeout(3300);
  await expect(pill).toHaveCount(0);
  await expect(plus).toHaveAttribute("aria-expanded", "false");

  // ×(펼친 + 버튼)를 다시 누르면 바로 접힌다
  await plus.click();
  await expect(pill).toBeVisible();
  await plus.click();
  await expect(pill).toHaveCount(0);
});

test("알약을 누르면 새로 추가가 열리고 메뉴는 접힌다. 닫은 뒤 +를 다시 누르면 다시 펼쳐진다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add-menu-open");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  await page.getByRole("link", { name: "결제 직접 입력" }).click();
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await expect(add).toBeVisible();
  await page.waitForTimeout(3300); // 남은 타이머가 있어도 문제없다
  await add.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "결제 직접 입력" })).toHaveCount(0);
  await page.getByRole("button", { name: "결제 입력 메뉴" }).click();
  await expect(page.getByRole("link", { name: "결제 직접 입력" })).toBeVisible();
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
  await add.getByRole("button", { name: /카드 문자 붙여넣기/ }).click();
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
  await add.getByRole("button", { name: /카드 문자 붙여넣기/ }).click();
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
  await add.getByRole("button", { name: /카드 문자 붙여넣기/ }).click();
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

test("클립보드를 못 읽으면 길게 눌러 붙여 넣으라고 안내한다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-paste-clip");
  await signIn(context, g.owner.email);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { readText: () => Promise.reject(new Error("denied")) } });
  });
  await page.goto("/?add=1");
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /카드 문자 붙여넣기/ }).click();
  await add.getByRole("button", { name: "붙여넣기" }).click();
  await expect(add.getByRole("alert")).toHaveText("입력칸을 길게 눌러 붙여 넣어 주세요.");
});

test("분기에서 직접 적기는 지금 흐름으로 간다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-paste-direct");
  await signIn(context, g.owner.email);
  await page.goto("/?add=1");
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await add.getByRole("button", { name: /직접 적기/ }).click();
  await expect(add.getByLabel("금액")).toBeVisible();
});
