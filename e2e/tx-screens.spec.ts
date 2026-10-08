import { expect, test, type Locator, type Page } from "@playwright/test";
import { APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, type GroupFixture } from "../tests/helpers/db";
import { at, kstStamp, pickCategory, readyGroupFixture, signIn } from "./support";

const db = adminClient();
const send = (g: GroupFixture, body: string, who: "owner" | "member" = "owner") =>
  ingestMessage(db, { userId: g[who].userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

async function manual(g: GroupFixture, merchant: string, amount = 8000) {
  const { data } = await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount, merchant, occurred_at: new Date(Date.now() - 60_000).toISOString(),
  }).select("id").single();
  return data!.id as string;
}

/** 줄을 손가락으로 왼쪽으로 민다 */
async function swipeLeft(page: Page, row: Locator, distance = 120) {
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width - 20 - (distance * i) / 6, y);
  await page.mouse.up();
}

const field = (dialog: Locator, label: string) => dialog.locator(".lx-field").filter({ hasText: label });

test("거래를 누르면 상세가 화면 가득 열리고, 분류를 고치면 반영되고, 닫으면 줄로 돌아간다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-detail");
  await send(g, at(APPROVAL, kstStamp(3)));
  await signIn(context, g.owner.email);
  await page.goto("/");

  await page.getByTestId("tx-row").first().click();
  const detail = page.getByRole("dialog", { name: "거래 상세" });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("12,300원").first()).toBeVisible();
  // 카드 문자 거래: 분류만 고칠 수 있다
  for (const label of ["금액", "어디서", "언제", "누가"]) await expect(field(detail, label)).toBeDisabled();
  await expect(detail.getByTestId("detail-card")).toHaveText("국민카드");

  await field(detail, "분류").click();
  const step = page.getByRole("region", { name: "분류 고치기" });
  await expect(step.getByRole("heading", { name: "어떤 분류예요?" })).toBeVisible();
  await step.getByRole("button", { name: "카페", exact: true }).click();
  await step.getByRole("button", { name: "확인" }).click();
  await expect(step).toHaveCount(0);
  await expect(field(detail, "분류")).toContainText("카페");

  await detail.getByRole("button", { name: "✕ 닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/tx=/);
  await expect(page.getByTestId("tx-row").first()).toContainText("카페");
  const { data: rule } = await db.from("merchant_rules").select("category_id").eq("group_id", g.groupId).maybeSingle();
  expect(rule).not.toBeNull();
});

test("상세의 온누리 체크는 결제 수단만 바꾸고, 휴대폰 '뒤로'로도 닫힌다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-detail-onnuri");
  await send(g, at(APPROVAL, kstStamp(3)));
  await signIn(context, g.owner.email);
  await page.goto("/");
  const total = await page.getByTestId("family-total").textContent();

  await page.getByTestId("tx-row").first().click();
  const detail = page.getByRole("dialog", { name: "거래 상세" });
  await detail.getByRole("checkbox", { name: /온누리상품권으로 결제/ }).check();
  await expect(detail.getByTestId("detail-card")).toHaveText("온누리상품권");

  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("tx-card").first()).toHaveText("온누리상품권");
  await expect(page.getByTestId("family-total")).toHaveText(total!);
});

test("직접 추가한 거래는 금액을 한 항목씩 고친다(잘못된 값은 이유를 보여 준다)", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-detail-manual");
  const id = await manual(g, "동네 시장");
  await signIn(context, g.owner.email);
  await page.goto(`/?tx=${id}`);
  const detail = page.getByRole("dialog", { name: "거래 상세" });
  await expect(field(detail, "누가")).toBeEnabled();

  await field(detail, "금액").click();
  const step = page.getByRole("region", { name: "금액 고치기" });
  const input = step.getByLabel("금액");
  await expect(input).toHaveValue("8000");
  await input.fill("");
  await step.getByRole("button", { name: "확인" }).click();
  await expect(step.getByRole("alert")).toHaveText("금액을 입력해 주세요.");
  await input.pressSequentially("15000");
  await expect(input).toHaveValue("1만 5000");
  await step.getByRole("button", { name: "확인" }).click();
  await expect(field(detail, "금액")).toContainText("15,000원");
  await expect(page.getByTestId("family-total")).toHaveText("15,000원 썼어요");
});

test("+로 새로 추가: 한 칸씩 묻고 답은 위에 쌓이며, 금액은 한글 단위로 보인다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-add");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("link", { name: "새로 추가" }).click();
  const add = page.getByRole("dialog", { name: "새로 추가" });
  const stacked = add.getByLabel("입력한 내용");

  const amount = add.getByLabel("금액");
  await amount.pressSequentially("100000");
  await expect(amount).toHaveValue("10만");
  await amount.pressSequentially("5"); // 화면 글자 "10만" 뒤가 아니라 실제 숫자(100000) 뒤에 붙는다
  await expect(amount).toHaveValue("100만 5");
  await add.getByRole("button", { name: "다음" }).click();
  await expect(stacked.getByRole("button", { name: /금액/ })).toContainText("100만 5원");

  await add.getByRole("textbox").fill("동네 시장");
  await add.getByRole("textbox").press("Enter");
  await add.getByRole("button", { name: "식비", exact: true }).click();
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("button", { name: "오늘" })).toHaveAttribute("aria-pressed", "true");
  await add.getByRole("button", { name: "다음" }).click();
  await expect(add.getByRole("button", { name: "e2e-add-owner" })).toHaveAttribute("aria-pressed", "true");
  await add.getByRole("button", { name: "다 입력했어요" }).click();
  await expect(add.getByRole("heading", { name: "다 입력했어요" })).toBeVisible();

  // 쌓인 값을 누르면 다시 고친다
  await stacked.getByRole("button", { name: /금액/ }).click();
  await add.getByLabel("금액").fill("13325");
  await expect(add.getByLabel("금액")).toHaveValue("1만 3325");
  await add.getByRole("button", { name: "고쳤어요" }).click();
  await expect(stacked.getByRole("button", { name: /금액/ })).toContainText("1만 3325원");

  await add.getByRole("button", { name: "저장하기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByTestId("tx-row").filter({ hasText: "동네 시장" });
  await expect(row).toContainText("식비");
  await expect(row.getByTestId("tx-card")).toHaveText("직접 입력");
  await expect(page.getByTestId("family-total")).toHaveText("13,325원 썼어요");
});

test("직접 추가한 줄은 밀어서 지우고, 카드 문자 줄은 지울 수 없다고 알려 준다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-swipe");
  await send(g, at(APPROVAL, kstStamp(30)));
  await manual(g, "지울 가게");
  await signIn(context, g.owner.email);
  await page.goto("/");

  const card = page.getByTestId("tx-row").filter({ hasText: "테스트커피" });
  await swipeLeft(page, card);
  await expect(page.getByRole("status")).toHaveText("카드 문자로 들어온 거래는 지울 수 없어요");
  await expect(page.getByRole("button", { name: "지우기" })).toHaveCount(0);

  const mine = page.getByTestId("tx-row").filter({ hasText: "지울 가게" });
  await swipeLeft(page, mine);
  await page.getByRole("button", { name: "지우기" }).click();
  const ask = page.getByRole("alertdialog", { name: "이 거래를 지울까요?" });
  await ask.getByRole("button", { name: "취소" }).click();
  await expect(ask).toHaveCount(0);
  await expect(mine).toHaveCount(1);

  await swipeLeft(page, mine);
  await page.getByRole("button", { name: "지우기" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "지우기" }).click();
  await expect(mine).toHaveCount(0);
  await expect(page.getByTestId("tx-row")).toHaveCount(1);
});

test("확인할 문자: 무시하면 접히고, 거래로 등록하면 찾은 값을 미리 채워 빠진 것만 묻는다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-inbox");
  await send(g, UNKNOWN_KB);
  await send(g, `[Web발신]\n신한카드(1234)승인 홍*동\n8,900원(일시불)\n${kstStamp(10)} 테스트분식\n누적 245,000원`, "member");
  await signIn(context, g.owner.email);
  await page.goto("/");

  await page.getByRole("button", { name: /확인할 문자가 2건 있어요/ }).click();
  const inbox = page.getByRole("dialog", { name: "확인할 문자" });
  await inbox.getByTestId("raw-item").filter({ hasText: "결제금액 안내" }).getByRole("button", { name: "무시" }).click();
  await expect(page.getByRole("status")).toHaveText("무시했어요");
  await expect(inbox.getByTestId("raw-item")).toHaveCount(1);

  await inbox.getByRole("button", { name: "거래로 등록" }).click();
  const add = page.getByRole("dialog", { name: "새로 추가" });
  await expect(add.getByText("문자에서 찾은 내용을 미리 채웠어요. 틀리면 눌러서 고쳐 주세요.")).toBeVisible();
  const stacked = add.getByLabel("입력한 내용");
  await expect(stacked.getByRole("button", { name: /금액/ })).toContainText("8900원");
  await expect(stacked.getByRole("button", { name: /어디서/ })).toContainText("테스트분식");
  await expect(stacked.getByRole("button", { name: /누가/ })).toContainText("e2e-inbox-member");
  // 빠진 분류만 묻는다
  await expect(add.getByRole("heading", { name: "어떤 분류예요?" })).toBeVisible();
  await add.getByRole("button", { name: "식비", exact: true }).click();
  await add.getByRole("button", { name: "다 입력했어요" }).click();
  await add.getByRole("button", { name: "저장하기" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("tx-row").filter({ hasText: "테스트분식" })).toContainText("e2e-inbox-member");
  await expect(page.getByRole("button", { name: /확인할 문자/ })).toHaveCount(0);
  // 등록한 뒤 뒤로 가면 확인할 문자 목록으로 간다
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "확인할 문자" }).getByText("확인할 문자가 없어요")).toBeVisible();
});

test("예전 주소(/new, /unparsed)는 새 화면으로 연다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-old-urls");
  await signIn(context, g.owner.email);
  await page.goto("/new");
  await expect(page.getByRole("dialog", { name: "새로 추가" })).toBeVisible();
  await page.goto("/unparsed");
  await expect(page.getByRole("dialog", { name: "확인할 문자" })).toBeVisible();
});

test("검토 반영: 다른 달로 옮기면 상세가 닫히고, 상세에서도 지울 수 있고, 고친 뒤 닫아도 '뒤로'가 한 번에 이전 화면으로 간다", async ({ page, context }) => {
  const g = await readyGroupFixture("e2e-review");
  const moving = await manual(g, "옮길 가게");
  await manual(g, "지울 가게2");
  await send(g, at(APPROVAL, kstStamp(3)));
  await signIn(context, g.owner.email);

  // 언제를 지난달로 바꾸면 이 달 목록에서 빠지며 상세가 닫힌다(빈 화면에 갇히지 않는다)
  await page.goto(`/?tx=${moving}`);
  await field(page.getByRole("dialog", { name: "거래 상세" }), "언제").click();
  const step = page.getByRole("region", { name: "언제 고치기" });
  const k = new Date(Date.now() + 9 * 3600_000);
  const lastMonth = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - 1, 15)).toISOString().slice(0, 10);
  await step.getByLabel("날짜").fill(lastMonth);
  await step.getByRole("button", { name: "확인" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("tx-row").filter({ hasText: "옮길 가게" })).toHaveCount(0);

  // 상세의 "이 거래 지우기"(밀기를 못 쓰는 경우)
  await page.getByTestId("tx-row").filter({ hasText: "지울 가게2" }).click();
  await page.getByRole("dialog", { name: "거래 상세" }).getByRole("button", { name: "이 거래 지우기" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "지우기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("tx-row").filter({ hasText: "지울 가게2" })).toHaveCount(0);

  // 고친 뒤(새로고침이 history 값을 바꿔도) 닫으면 뒤로 간 것이라, 다음 '뒤로'는 이전 화면으로 간다
  const p2 = await context.newPage();
  await p2.goto("/categories");
  await p2.goto("/");
  await p2.getByTestId("tx-row").filter({ hasText: "테스트커피" }).click();
  await pickCategory(p2, "카페");
  await p2.getByRole("dialog", { name: "거래 상세" }).getByRole("button", { name: "✕ 닫기" }).click();
  await expect(p2.getByRole("dialog")).toHaveCount(0);
  await p2.goBack();
  await expect(p2).toHaveURL(/\/categories$/);
});
