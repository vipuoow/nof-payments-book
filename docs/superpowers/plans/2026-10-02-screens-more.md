# 예산·카테고리 관리·기기 연결 안내 (계획 3-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한 번 정하면 매달 이어지는 예산(가족 전체 + 카테고리별)과 홈의 예산 표시, 기본 카테고리 숨김·그룹 카테고리·가맹점 규칙 관리, 기종 탭으로 고르는 기기 연결 안내를 만들고, 3-1에서 미룬 사소한 문제 5가지를 고친다.

**Architecture:** 3-1과 같다. 서버 컴포넌트가 로그인 사용자 권한(RLS)으로 읽고, 수정은 서버 액션으로 한다. 예산 적용 계산·카테고리 이름 검증·기기 안내 값은 순수 함수(`src/ledger/budget.ts`, `src/ledger/categories.ts`, `src/ledger/devices.ts`)로 두고 단위 테스트한다. 예산은 바뀐 달에만 한 줄 저장하고 "그 달 이전 가장 최근 값"으로 적용한다. 기본 카테고리 숨김은 새 테이블 `category_hidden`에 둔다.

**Tech Stack:** Next.js 16(App Router, 서버 액션, `useActionState`), React 19, Tailwind CSS 4, @supabase/ssr, Vitest, Playwright(WebKit, iPhone 13), 로컬 Supabase(Postgres 17)

**Spec:** `docs/superpowers/specs/2026-10-02-screens-more-design.md` (상위: `docs/superpowers/specs/2026-10-02-screens-core-design.md`, `docs/superpowers/specs/2026-10-01-nof-payments-book-design.md`)

## Global Constraints

- 작업 원칙: **각 Task 시작 전과 모든 커밋 전에 사용자 승인**을 받는다. 계획 4(NAS 배포)는 이 계획이 끝난 뒤 **다시 물어보고** 시작한다.
- 공개 저장소: 실제 문자·이름·주소·비밀값을 커밋하지 않는다. 테스트 데이터는 가상 값만. 커밋 전 `.githooks/pre-commit`이 통과해야 한다.
- 화면의 읽기·쓰기는 로그인 사용자 권한(`createSupabaseServerClient`/`loadMe`, RLS). 화면 코드에서 `service_role`을 쓰지 않는다. jev 분류(`src/categorize`)만 기존처럼 서버 관리자 권한이다.
- 이 Next.js는 학습 데이터와 다르다. 새 API는 `node_modules/next/dist/docs/`를 먼저 읽는다. 서버 액션의 `redirect`는 `RedirectType.replace`를 쓴다(3-1 결정).
- React 19는 액션 뒤 폼을 초기화하고 `<select>`는 바뀐 `defaultValue`를 다시 읽지 않는다. 실패하면 입력값(`values`)을 돌려주고 폼에 `key={JSON.stringify(values ?? null)}`를 줘 다시 만든다(3-1 결정).
- 아이폰 확대 방지: 입력칸 글자는 16px 이상(`text-base`).
- 시간대: 예산 달·사용액은 한국 시간(KST) 기준. 예산 저장 달은 이번 달(KST) 1일.
- 설정값: 경고 기준 `budget_warning_ratio`(0.8)를 `app_settings`에서 읽는다.
- 문구: 저장 실패 `저장하지 못했습니다. 다시 시도해 주세요.`, 예산 입력 오류 `0 이상 숫자로 입력해 주세요.`, 이름 오류 `이름을 입력해 주세요.` / `이름은 20자까지 입력할 수 있습니다.` / `이미 있는 이름입니다.`, 처리된 문자 `이미 처리된 문자입니다.`
- 검증: 매 Task 끝에 `pnpm test`, `pnpm test:db`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`, `pnpm secrets:scan`을 모두 실행한다. 로컬 Supabase가 켜져 있어야 한다.
- 로컬 DB 마이그레이션은 `supabase migration up --local`(`db reset` 금지).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **예산을 지난달에 정하고 이번 달에는 손대지 않은 경우**: 이번 달 홈에도 그 예산이 나와야 하고, 이번 달에 바꾸면 지난달 화면은 예전 예산 그대로여야 한다. → Task 3(단위), Task 4(e2e)
2. **카테고리 예산 칸을 비워 저장한 경우**: 이번 달부터 그 카테고리 예산이 사라지고 홈 경고에서도 빠져야 한다. 원래 없던 칸은 아무것도 저장하지 않아야 한다. → Task 5(e2e·DB 확인)
3. **기본 카테고리를 숨긴 뒤**: 거래 시트·직접 입력·예산 화면·jev 선택지에서 빠지고, 이미 그 카테고리인 거래는 홈에 이름이 그대로 보여야 한다. 다른 그룹에는 영향이 없어야 한다. → Task 1(DB), Task 2(jev), Task 6(e2e)
4. **그룹 카테고리를 지운 경우**: 그 카테고리 거래는 미지정(출처도 비움), 관련 규칙·예산은 사라져야 한다. → Task 6(e2e·DB 확인)
5. **기종 탭을 바꾸거나 토큰을 발급한 뒤 복사값**: `source`가 기종에 맞고, 발급 직후 헤더에 실제 토큰이 들어가야 한다. → Task 7(단위·e2e)

## 스펙과 다르게 구체화한 부분

- 숨긴 기본 카테고리의 예산은 홈 경고에서 뺀다(예산 화면에서 숨긴 카테고리를 고칠 수 없어 경고가 영구히 남기 때문. 최종 검토 후 변경). 다시 보이게 하면 예산도 다시 적용된다.
- 예산 저장은 DB의 현재 값이 아니라 화면을 연 때의 값과 비교해 손댄 칸만 쓴다(열어 둔 화면이 다른 사람의 변경을 덮어쓰지 않게, 최종 검토 후 변경).
- 예산 칸에 0을 직접 넣으면 "없음"과 같다.
- 기기 탭을 바꿔도 방금 발급한 토큰 표시는 유지된다(토큰은 기종과 무관, 최종 검토 후 변경).
- 경고 색 토큰 `warning`(주황)을 디자인 토큰에 더한다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20261002000200_budgets_categories.sql` | 예산 0 허용, 그룹 카테고리 이름 고유, `category_hidden`, `ingest_sms`(먼저 온 취소에 카테고리 맞춤) |
| `src/categorize/categorize.ts` | jev 선택지에서 숨김 제외, 연결된 취소 카테고리 맞춤 |
| `src/ledger/budget.ts` | 적용 예산, 사용률·경고 단계, 카테고리별 사용액, 예산 입력 해석 |
| `src/ledger/categories.ts` | 카테고리 이름 검증 |
| `src/ledger/devices.ts` | 기종 해석, 기종별 안내 단계·복사값, 토큰 상태 |
| `src/ledger/queries.ts` | 숨김 반영 카테고리, 적용 예산, 경고 기준 읽기 |
| `src/components/ledger/budget-summary.tsx` | 홈 예산 표시 |
| `src/app/budget/*` | 예산 화면·저장 액션 |
| `src/app/categories/*` | 카테고리·규칙 관리 화면·액션 |
| `src/app/devices/page.tsx`, `src/components/devices/*` | 기종 탭, 안내, 복사 |
| `src/components/app-menu.tsx`, `src/components/ledger/modal-sheet.tsx` | 메뉴 바깥 탭 닫기, 시트 접근성 |
| `e2e/*.spec.ts`, `e2e/support.ts` | 화면 테스트, 시드 시각 도우미 |
| `tests/db/budgets-categories.db.test.ts` | DB 테스트 |

---

### Task 1: 예산·카테고리 DB 변경

**Files:**
- Create: `supabase/migrations/20261002000200_budgets_categories.sql`, `tests/db/budgets-categories.db.test.ts`

**Interfaces:**
- Produces: `budgets.amount >= 0`; 인덱스 `categories_group_name`(그룹 카테고리 이름 고유); 테이블 `category_hidden(group_id, category_id)`(authenticated: select/insert/delete, 기본 카테고리만); `ingest_sms`가 먼저 온 취소를 연결할 때 취소의 빈 카테고리를 결제 것으로 채움.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/db/budgets-categories.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture, type GroupFixture } from "../helpers/db";

const db = adminClient();

async function defaultId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

describe("budgets", () => {
  it("0(이 달부터 없음)을 저장할 수 있고, 같은 달·카테고리는 upsert로 한 줄만 남는다", async () => {
    const g = await createGroupFixture("bud");
    const c = g.owner.client;
    const row = (amount: number) => ({ group_id: g.groupId, category_id: null, month: "2026-10-01", amount });
    expect((await c.from("budgets").upsert(row(300000), { onConflict: "group_id,category_id,month" })).error).toBeNull();
    expect((await c.from("budgets").upsert(row(0), { onConflict: "group_id,category_id,month" })).error).toBeNull();
    const { data } = await db.from("budgets").select("amount").eq("group_id", g.groupId);
    expect(data).toEqual([{ amount: 0 }]);
  });

  it("음수는 막고, 다른 그룹 예산은 쓸 수 없다", async () => {
    const g = await createGroupFixture("bud-neg");
    const other = await createGroupFixture("bud-other");
    const neg = await g.owner.client.from("budgets").insert({ group_id: g.groupId, month: "2026-10-01", amount: -1 });
    expect(neg.error).not.toBeNull();
    const foreign = await other.owner.client.from("budgets").insert({ group_id: g.groupId, month: "2026-10-01", amount: 1 });
    expect(foreign.error).not.toBeNull();
  });
});

describe("category_hidden", () => {
  it("기본 카테고리만 숨길 수 있고, 다른 그룹에서는 보이지도 쓰지도 못한다", async () => {
    const g = await createGroupFixture("hide");
    const other = await createGroupFixture("hide-other");
    const culture = await defaultId("문화");
    const { data: mine } = await db.from("categories").insert({ group_id: g.groupId, name: "반려동물", sort_order: 10 }).select("id").single();

    expect((await g.owner.client.from("category_hidden").insert({ group_id: g.groupId, category_id: culture })).error).toBeNull();
    expect((await g.owner.client.from("category_hidden").insert({ group_id: g.groupId, category_id: mine!.id })).error).not.toBeNull();
    expect((await other.owner.client.from("category_hidden").insert({ group_id: g.groupId, category_id: culture })).error).not.toBeNull();

    const { data: seenByOther } = await other.owner.client.from("category_hidden").select("category_id");
    expect(seenByOther).toEqual([]);
    const { data: seenByMember } = await g.member.client.from("category_hidden").select("category_id");
    expect(seenByMember).toEqual([{ category_id: culture }]);

    expect((await g.member.client.from("category_hidden").delete().eq("category_id", culture)).error).toBeNull();
    const { data: after } = await db.from("category_hidden").select("category_id").eq("group_id", g.groupId);
    expect(after).toEqual([]);
  });
});

describe("그룹 카테고리 이름", () => {
  it("같은 그룹 안에서 같은 이름은 막는다(다른 그룹은 허용)", async () => {
    const g = await createGroupFixture("cat-name");
    const other = await createGroupFixture("cat-name-other");
    expect((await g.owner.client.from("categories").insert({ group_id: g.groupId, name: "육아", sort_order: 10 })).error).toBeNull();
    const dup = await g.owner.client.from("categories").insert({ group_id: g.groupId, name: "육아", sort_order: 11 });
    expect(dup.error?.code).toBe("23505");
    expect((await other.owner.client.from("categories").insert({ group_id: other.groupId, name: "육아", sort_order: 10 })).error).toBeNull();
  });
});

describe("먼저 온 취소의 카테고리", () => {
  it("취소가 미지정이고 결제가 규칙으로 정해지면 취소도 같은 카테고리가 된다", async () => {
    const cafe = await defaultId("카페");
    const g: GroupFixture = await createGroupFixture("early-cat");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    const recv = new Date("2026-09-23T08:40:00+09:00");
    const cancel = await ingestMessage(db, owner, { body: CANCEL, receivedAt: recv, source: "manual_test" });
    await db.from("merchant_rules").insert({ group_id: g.groupId, merchant_pattern: "테스트커피 강남역점(메가", category_id: cafe });
    const approval = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: recv, source: "manual_test" });

    const { data } = await db.from("transactions")
      .select("id, category_id, category_source, cancels_transaction_id")
      .in("id", [cancel.transactionId!, approval.transactionId!]);
    const byId = new Map(data!.map((r) => [r.id, r]));
    expect(byId.get(approval.transactionId!)).toMatchObject({ category_id: cafe, category_source: "rule" });
    expect(byId.get(cancel.transactionId!)).toMatchObject({
      category_id: cafe, category_source: "rule", cancels_transaction_id: approval.transactionId,
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run tests/db/budgets-categories.db.test.ts`
Expected: FAIL (0 저장이 `budgets_amount_check` 위반, `category_hidden` 없음, 중복 이름 허용, 취소 카테고리 null)

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/20261002000200_budgets_categories.sql`:

```sql
-- 예산: 0은 "이 달부터 예산 없음". 적용 예산은 그 달 이전 가장 최근 행(화면에서 계산).
alter table public.budgets drop constraint budgets_amount_check;
alter table public.budgets add constraint budgets_amount_check check (amount >= 0);

-- 그룹 카테고리 이름은 그룹 안에서 겹치지 않는다(기본 이름과의 비교는 화면에서).
create unique index categories_group_name on public.categories (group_id, name) where group_id is not null;

-- 그룹별로 숨긴 기본 카테고리
create table public.category_hidden (
  group_id uuid not null references public.groups (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (group_id, category_id)
);

alter table public.category_hidden enable row level security;
revoke all on public.category_hidden from anon;
grant select, insert, delete on public.category_hidden to authenticated;

create policy category_hidden_read on public.category_hidden
  for select to authenticated using (group_id = public.my_group_id());
create policy category_hidden_insert on public.category_hidden
  for insert to authenticated
  with check (
    group_id = public.my_group_id()
    and exists (select 1 from public.categories c where c.id = category_id and c.group_id is null)
  );
create policy category_hidden_delete on public.category_hidden
  for delete to authenticated using (group_id = public.my_group_id());

-- ingest_sms: 먼저 온 취소를 결제에 연결할 때 취소의 카테고리가 비어 있으면 결제 것으로 채운다.
-- 나머지는 20261002000100_ledger_screens.sql과 같다.
create or replace function public.ingest_sms(
  p_group uuid,
  p_user uuid,
  p_body text,
  p_body_hash text,
  p_source text,
  p_received_at timestamptz,
  p_status text,
  p_parser_id text,
  p_kind text default null,
  p_amount bigint default null,
  p_merchant text default null,
  p_occurred_at timestamptz default null,
  p_issuer text default null
) returns jsonb
language plpgsql set search_path = public
as $$
declare
  v_duplicate boolean;
  v_raw_id uuid;
  v_category_id uuid;
  v_category_source text;
  v_cancels_id uuid;
  v_early_cancel_id uuid;
  v_early_category_id uuid;
  v_early_category_source text;
  v_tx_id uuid;
begin
  -- 같은 사용자의 문자는 하나씩 처리한다 (중복 판정·취소 연결 경쟁 방지)
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  if p_kind = 'approval' then
    -- 같은 승인 문자라도 앞선 승인이 이미 취소됐다면 재승인이다
    select exists (
      select 1 from public.raw_messages r
      where r.user_id = p_user and r.body_hash = p_body_hash
        and not exists (
          select 1
          from public.transactions t
          join public.transactions c on c.cancels_transaction_id = t.id
          where t.raw_message_id = r.id and t.kind = 'approval'
        )
    ) into v_duplicate;
  else
    select exists (
      select 1 from public.raw_messages r
      where r.user_id = p_user and r.body_hash = p_body_hash
    ) into v_duplicate;
  end if;

  if v_duplicate then
    return jsonb_build_object('status', 'duplicate');
  end if;

  insert into public.raw_messages (group_id, user_id, body, body_hash, source, received_at, status, parser_id)
  values (p_group, p_user, p_body, p_body_hash, p_source, p_received_at, p_status, p_parser_id)
  returning id into v_raw_id;

  if p_kind is null then
    return jsonb_build_object('status', p_status);
  end if;

  select category_id into v_category_id
  from public.merchant_rules
  where group_id = p_group and merchant_pattern = p_merchant;
  if v_category_id is not null then
    v_category_source := 'rule';
  end if;

  if p_kind = 'cancel' then
    v_cancels_id := public.find_cancel_target(p_group, p_user, p_amount, p_merchant, p_occurred_at);
    if v_category_id is null and v_cancels_id is not null then
      select category_id, category_source into v_category_id, v_category_source
      from public.transactions where id = v_cancels_id;
    end if;
  end if;

  if p_kind = 'approval' then
    select c.id, c.category_id, c.category_source
      into v_early_cancel_id, v_early_category_id, v_early_category_source
    from public.transactions c
    where c.group_id = p_group
      and c.user_id = p_user
      and c.kind = 'cancel'
      and c.cancels_transaction_id is null
      and c.amount = -p_amount
      and c.merchant = p_merchant
      and c.occurred_at >= p_occurred_at
      and c.occurred_at < p_occurred_at + interval '60 days'
    order by c.occurred_at
    limit 1;
    if v_category_id is null and v_early_category_id is not null then
      v_category_id := v_early_category_id;
      v_category_source := v_early_category_source;
    end if;
  end if;

  insert into public.transactions (
    group_id, user_id, raw_message_id, kind, amount, merchant, occurred_at, issuer,
    category_id, category_source, cancels_transaction_id
  ) values (
    p_group, p_user, v_raw_id, p_kind,
    case when p_kind = 'cancel' then -p_amount else p_amount end,
    p_merchant, p_occurred_at, p_issuer, v_category_id, v_category_source, v_cancels_id
  )
  returning id into v_tx_id;

  if v_early_cancel_id is not null then
    -- SET의 오른쪽은 모두 바꾸기 전 값을 본다
    update public.transactions
    set cancels_transaction_id = v_tx_id,
        category_id = coalesce(category_id, v_category_id),
        category_source = case when category_id is null then v_category_source else category_source end
    where id = v_early_cancel_id;
  end if;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;
```

- [ ] **Step 4: 마이그레이션 적용 후 테스트 통과 확인**

Run: `supabase migration up --local && pnpm vitest run tests/db/budgets-categories.db.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과(기존 `ledger.db.test.ts`의 먼저 온 취소 테스트 포함)

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add supabase/migrations/20261002000200_budgets_categories.sql tests/db/budgets-categories.db.test.ts
git commit -m "feat: 예산 끄기(0)·카테고리 숨김·그룹 카테고리 이름 고유와 먼저 온 취소 카테고리 맞춤

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: jev 분류에 숨김·취소 맞춤 반영

**Files:**
- Modify: `src/categorize/categorize.ts` (`categorizeTransaction`)
- Test: `tests/db/categorize.db.test.ts` (테스트 2개 추가)

**Interfaces:**
- Consumes: Task 1의 `category_hidden`
- Produces: `categorizeTransaction`이 숨긴 카테고리를 선택지에서 빼고, 분류 저장 후 연결된 미지정 취소를 같은 카테고리(`ai`)로 채운다. 시그니처는 그대로.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/db/categorize.db.test.ts`의 `describe("categorizeTransaction")` 안 끝에 추가(맨 위 import에 `CANCEL` 추가: `import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";`):

```ts
  it("그룹이 숨긴 기본 카테고리는 선택지에서 빠진다", async () => {
    const { g, id } = await newApproval("cat-hidden");
    await db.from("category_hidden").insert({ group_id: g.groupId, category_id: await defaultCategoryId("문화") });
    let seen: CategoryOption[] = [];
    const classify: CategoryClassifier = async (_m, options) => { seen = options; return null; };
    await categorizeTransaction(db, classify, id);
    expect(seen.map((o) => o.name)).not.toContain("문화");
    expect(seen.map((o) => o.name)).toContain("카페");
  });

  it("결제를 분류하면 연결된 미지정 취소도 같은 카테고리가 된다", async () => {
    const { g, id } = await newApproval("cat-cancel-sync");
    const cancel = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: CANCEL, receivedAt: received, source: "manual_test" });
    expect(await tx(cancel.transactionId!)).toEqual({ category_id: null, category_source: null });

    expect(await categorizeTransaction(db, answer("카페", 0.98), id)).toBe("categorized");
    expect(await tx(cancel.transactionId!)).toEqual({ category_id: await defaultCategoryId("카페"), category_source: "ai" });
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run tests/db/categorize.db.test.ts`
Expected: FAIL (선택지에 "문화" 포함, 취소 카테고리 null)

- [ ] **Step 3: 구현**

`src/categorize/categorize.ts`의 `categorizeTransaction`에서 카테고리 읽기부터 끝까지를 다음으로 바꾼다:

```ts
  const [categories, hidden, setting] = await Promise.all([
    db.from("categories").select("id, name, group_id")
      .or(`group_id.is.null,group_id.eq.${tx.group_id}`)
      .order("sort_order"),
    db.from("category_hidden").select("category_id").eq("group_id", tx.group_id),
    db.from("app_settings").select("value").eq("key", "category_ai_min_confidence").single(),
  ]);
  if (categories.error) throw categories.error;
  if (hidden.error) throw hidden.error;
  if (setting.error) throw setting.error;

  // 그룹이 숨긴 기본 카테고리는 고르지 않는다
  const hiddenIds = new Set(hidden.data.map((h) => h.category_id));
  const options = categoryOptions(categories.data.filter((c) => !hiddenIds.has(c.id)));
  const categoryId = pickCategory(await classify(tx.merchant, options), options, Number(setting.data.value));
  if (!categoryId) return "undecided";

  const { data: updated, error: updateError } = await db
    .from("transactions")
    .update({ category_id: categoryId, category_source: "ai" })
    .eq("id", transactionId)
    .is("category_id", null)
    .select("id");
  if (updateError) throw updateError;
  if (updated.length === 0) return "skipped";

  // 이 결제에 연결된 취소가 미지정이면 같은 카테고리로 맞춰 카테고리별 합계가 상쇄되게 한다
  const { error: cancelError } = await db
    .from("transactions")
    .update({ category_id: categoryId, category_source: "ai" })
    .eq("cancels_transaction_id", transactionId)
    .is("category_id", null);
  if (cancelError) throw cancelError;
  return "categorized";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run tests/db/categorize.db.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add src/categorize/categorize.ts tests/db/categorize.db.test.ts
git commit -m "feat: jev가 숨긴 카테고리를 고르지 않고 연결된 취소도 함께 분류

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 예산·카테고리·기기 순수 함수

**Files:**
- Create: `src/ledger/budget.ts`, `src/ledger/categories.ts`, `src/ledger/devices.ts`
- Test: `src/ledger/budget.test.ts`, `src/ledger/categories.test.ts`, `src/ledger/devices.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // budget.ts
  export const TOTAL = "total";                                   // 가족 전체 예산 키
  export type BudgetRow = { categoryId: string | null; month: string; amount: number }; // month "YYYY-MM-01"
  export type BudgetLevel = "ok" | "warn" | "over";
  export function budgetMonth(m: Month): string;                  // "2026-10-01"
  export function effectiveBudgets(rows: BudgetRow[], m: Month): Map<string, number>; // 키: 카테고리 id 또는 TOTAL, 0 제외
  export function budgetStatus(spent: number, budget: number, warnRatio: number): { ratio: number; remaining: number; level: BudgetLevel };
  export function spentByCategory(txs: LedgerTx[]): Map<string, number>;
  export function parseBudgetInput(text: string): { ok: true; amount: number | null } | { ok: false; error: string };
  // categories.ts
  export function validateCategoryName(raw: string, taken: string[]): { ok: true; name: string } | { ok: false; error: string };
  // devices.ts
  export type Device = "iphone" | "android";
  export const DEVICE_LABEL: Record<Device, string>;
  export const DEVICE_STEPS: Record<Device, string[]>;
  export function parseDevice(value: string | string[] | undefined): Device;
  export function deviceGuide(device: Device, appUrl: string, token: string | null): { url: string; headerValue: string; body: string; source: string };
  export function tokenHealth(lastUsedAt: string | null, now: Date): "never" | "stale" | "ok";
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ledger/budget.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { budgetMonth, budgetStatus, effectiveBudgets, parseBudgetInput, spentByCategory, TOTAL } from "./budget";
import type { LedgerTx } from "./summary";

const oct = { year: 2026, month: 10 };
const sep = { year: 2026, month: 9 };

describe("effectiveBudgets", () => {
  const rows = [
    { categoryId: null, month: "2026-08-01", amount: 2000000 },
    { categoryId: null, month: "2026-10-01", amount: 3000000 },
    { categoryId: "cafe", month: "2026-09-01", amount: 100000 },
    { categoryId: "food", month: "2026-09-01", amount: 500000 },
    { categoryId: "food", month: "2026-10-01", amount: 0 },
    { categoryId: "shop", month: "2026-11-01", amount: 50000 },
  ];

  it("그 달 이전 가장 최근 값을 쓰고, 0(끔)과 미래 행은 뺀다", () => {
    expect(effectiveBudgets(rows, oct)).toEqual(new Map([[TOTAL, 3000000], ["cafe", 100000]]));
  });

  it("지난달은 그때 적용되던 예산", () => {
    expect(effectiveBudgets(rows, sep)).toEqual(new Map([[TOTAL, 2000000], ["cafe", 100000], ["food", 500000]]));
  });

  it("budgetMonth", () => {
    expect(budgetMonth(oct)).toBe("2026-10-01");
    expect(budgetMonth({ year: 2027, month: 1 })).toBe("2027-01-01");
  });
});

describe("budgetStatus", () => {
  it("80% 미만 ok, 80~100% warn, 100% 초과 over", () => {
    expect(budgetStatus(79000, 100000, 0.8)).toEqual({ ratio: 0.79, remaining: 21000, level: "ok" });
    expect(budgetStatus(80000, 100000, 0.8)).toMatchObject({ level: "warn" });
    expect(budgetStatus(100000, 100000, 0.8)).toMatchObject({ level: "warn", remaining: 0 });
    expect(budgetStatus(123000, 100000, 0.8)).toMatchObject({ level: "over", remaining: -23000 });
  });
});

describe("spentByCategory", () => {
  it("카테고리별 합계(취소 반영, 미지정 제외)", () => {
    const t = (categoryId: string | null, amount: number) => ({ categoryId, amount }) as LedgerTx;
    expect(spentByCategory([t("cafe", 12300), t("cafe", -12300), t("cafe", 5000), t(null, 900), t("food", 8000)]))
      .toEqual(new Map([["cafe", 5000], ["food", 8000]]));
  });
});

describe("parseBudgetInput", () => {
  it("빈칸은 없음, 쉼표·원·공백 정리, 음수·문자·1조 이상은 오류", () => {
    expect(parseBudgetInput("")).toEqual({ ok: true, amount: null });
    expect(parseBudgetInput("  ")).toEqual({ ok: true, amount: null });
    expect(parseBudgetInput("3,000,000원")).toEqual({ ok: true, amount: 3000000 });
    expect(parseBudgetInput("0")).toEqual({ ok: true, amount: 0 });
    for (const bad of ["-1", "abc", "1.5", "1000000000000"]) {
      expect(parseBudgetInput(bad)).toEqual({ ok: false, error: "0 이상 숫자로 입력해 주세요." });
    }
  });
});
```

`src/ledger/categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateCategoryName } from "./categories";

describe("validateCategoryName", () => {
  const taken = ["식비", "카페", "육아"];
  it("앞뒤 공백을 지우고 받아들인다", () => {
    expect(validateCategoryName("  반려동물 ", taken)).toEqual({ ok: true, name: "반려동물" });
  });
  it("빈칸·20자 초과·이미 있는 이름은 막는다", () => {
    expect(validateCategoryName("   ", taken)).toEqual({ ok: false, error: "이름을 입력해 주세요." });
    expect(validateCategoryName("가".repeat(21), taken)).toEqual({ ok: false, error: "이름은 20자까지 입력할 수 있습니다." });
    expect(validateCategoryName("가".repeat(20), taken)).toMatchObject({ ok: true });
    expect(validateCategoryName("카페", taken)).toEqual({ ok: false, error: "이미 있는 이름입니다." });
    expect(validateCategoryName(" 육아", taken)).toEqual({ ok: false, error: "이미 있는 이름입니다." });
  });
});
```

`src/ledger/devices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEVICE_STEPS, deviceGuide, parseDevice, tokenHealth } from "./devices";

describe("parseDevice", () => {
  it("android만 갤럭시, 나머지는 아이폰", () => {
    expect(parseDevice("android")).toBe("android");
    expect(parseDevice("iphone")).toBe("iphone");
    expect(parseDevice(undefined)).toBe("iphone");
    expect(parseDevice(["android"])).toBe("iphone");
    expect(parseDevice("windows")).toBe("iphone");
  });
});

describe("deviceGuide", () => {
  it("기종별 source와 문자 내용 자리, 토큰 전에는 자리 표시", () => {
    expect(deviceGuide("iphone", "https://ledger.example/", null)).toEqual({
      url: "https://ledger.example/api/ingest",
      headerValue: "Bearer <토큰>",
      body: '{"body":"메시지 내용","source":"ios_shortcut"}',
      source: "ios_shortcut",
    });
    expect(deviceGuide("android", "https://ledger.example", "tok123")).toEqual({
      url: "https://ledger.example/api/ingest",
      headerValue: "Bearer tok123",
      body: '{"body":"[sms_message]","source":"android_macrodroid"}',
      source: "android_macrodroid",
    });
  });

  it("안내 단계가 기종 앱을 가리킨다", () => {
    expect(DEVICE_STEPS.iphone.join(" ")).toContain("단축어");
    expect(DEVICE_STEPS.android.join(" ")).toContain("MacroDroid");
  });
});

describe("tokenHealth", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  it("받은 적 없음·3일 초과·정상", () => {
    expect(tokenHealth(null, now)).toBe("never");
    expect(tokenHealth("2026-10-01T23:59:59Z", now)).toBe("stale");
    expect(tokenHealth("2026-10-02T00:00:00Z", now)).toBe("ok");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run src/ledger/budget.test.ts src/ledger/categories.test.ts src/ledger/devices.test.ts`
Expected: FAIL (`Cannot find module`)

- [ ] **Step 3: 구현**

`src/ledger/budget.ts`:

```ts
import { monthParam, type Month } from "./month";
import type { LedgerTx } from "./summary";

/** 가족 전체 예산의 키(카테고리 id 자리) */
export const TOTAL = "total";

export type BudgetRow = { categoryId: string | null; month: string; amount: number };
export type BudgetLevel = "ok" | "warn" | "over";

/** 예산 행의 달(그 달 1일) */
export function budgetMonth(m: Month): string {
  return `${monthParam(m)}-01`;
}

/** 그 달에 적용되는 예산: 카테고리마다 그 달 이전 가장 최근 행. 0은 "이 달부터 없음"이라 뺀다. */
export function effectiveBudgets(rows: BudgetRow[], m: Month): Map<string, number> {
  const target = budgetMonth(m);
  const latest = new Map<string, BudgetRow>();
  for (const row of rows) {
    if (row.month > target) continue;
    const key = row.categoryId ?? TOTAL;
    const current = latest.get(key);
    if (!current || row.month > current.month) latest.set(key, row);
  }
  return new Map([...latest].filter(([, r]) => r.amount > 0).map(([key, r]) => [key, r.amount]));
}

/** 사용률과 경고 단계. 정확히 100%는 초과가 아니다. */
export function budgetStatus(spent: number, budget: number, warnRatio: number) {
  const ratio = spent / budget;
  const level: BudgetLevel = ratio > 1 ? "over" : ratio >= warnRatio ? "warn" : "ok";
  return { ratio, remaining: budget - spent, level };
}

/** 카테고리별 사용액(취소는 음수라 그대로 더한다). 미지정은 뺀다. */
export function spentByCategory(txs: LedgerTx[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const tx of txs) {
    if (tx.categoryId) sums.set(tx.categoryId, (sums.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return sums;
}

/** 예산 입력칸: 빈칸은 없음(null). 쉼표·"원"·공백은 지우고 0 이상 1조 미만 정수만 받는다. */
export function parseBudgetInput(text: string): { ok: true; amount: number | null } | { ok: false; error: string } {
  const cleaned = text.replace(/[,\s원]/g, "");
  if (cleaned === "") return { ok: true, amount: null };
  if (!/^\d+$/.test(cleaned) || Number(cleaned) >= 1e12) return { ok: false, error: "0 이상 숫자로 입력해 주세요." };
  return { ok: true, amount: Number(cleaned) };
}
```

`src/ledger/categories.ts`:

```ts
/** 그룹 카테고리 이름: 앞뒤 공백 제거, 1~20자, 이미 쓰는 이름(기본 + 그룹)과 겹치면 안 된다. */
export function validateCategoryName(raw: string, taken: string[]): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if ([...name].length > 20) return { ok: false, error: "이름은 20자까지 입력할 수 있습니다." };
  if (taken.includes(name)) return { ok: false, error: "이미 있는 이름입니다." };
  return { ok: true, name };
}
```

`src/ledger/devices.ts`:

```ts
export type Device = "iphone" | "android";

export const DEVICE_LABEL: Record<Device, string> = { iphone: "아이폰", android: "갤럭시" };

/** 기종별 설정 안내. 메뉴 이름은 OS·앱 버전에 따라 조금 다를 수 있다. */
export const DEVICE_STEPS: Record<Device, string[]> = {
  iphone: [
    "단축어 앱을 열고 [자동화] → [+] → [메시지]를 고릅니다.",
    "\"메시지에 다음이 포함됨\"에 KB국민카드를 넣고, [즉시 실행]을 켠 뒤 [다음]을 누릅니다.",
    "[새로운 빈 단축어]를 고르고 동작 [URL 콘텐츠 가져오기]를 추가합니다.",
    "URL에 아래 주소를 붙여넣고, 방법을 POST로, 헤더에 Authorization = 아래 헤더 값을 넣습니다.",
    "본문을 JSON으로 하고 body = 단축어 입력의 [메시지 내용], source = ios_shortcut 을 넣습니다.",
    "결제 후 홈에 거래가 나타나는지 확인합니다.",
  ],
  android: [
    "MacroDroid 앱을 설치하고 [매크로 추가]를 누릅니다.",
    "트리거 [SMS 수신]을 고르고, 내용에 KB국민카드가 포함될 때로 정합니다.",
    "동작 [HTTP 요청]을 추가해 방법 POST, URL에 아래 주소, 헤더에 Authorization = 아래 헤더 값을 넣습니다.",
    "콘텐츠 유형을 application/json으로 하고, 본문에 아래 보낼 내용을 붙여넣습니다([sms_message]가 문자 내용 자리입니다).",
    "휴대폰 설정에서 MacroDroid의 배터리 최적화를 끕니다.",
    "결제 후 홈에 거래가 나타나는지 확인합니다.",
  ],
};

export function parseDevice(value: string | string[] | undefined): Device {
  return value === "android" ? "android" : "iphone";
}

/** 복사할 값. 토큰은 발급 직후에만 알 수 있으므로 그 전에는 자리 표시. */
export function deviceGuide(device: Device, appUrl: string, token: string | null) {
  const source = device === "iphone" ? "ios_shortcut" : "android_macrodroid";
  return {
    url: `${appUrl.replace(/\/+$/, "")}/api/ingest`,
    headerValue: `Bearer ${token ?? "<토큰>"}`,
    body: JSON.stringify({ body: device === "iphone" ? "메시지 내용" : "[sms_message]", source }),
    source,
  };
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** 마지막 수신이 3일보다 오래되면 stale */
export function tokenHealth(lastUsedAt: string | null, now: Date): "never" | "stale" | "ok" {
  if (!lastUsedAt) return "never";
  return now.getTime() - new Date(lastUsedAt).getTime() > THREE_DAYS_MS ? "stale" : "ok";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run src/ledger`
Expected: PASS

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add src/ledger/budget.ts src/ledger/budget.test.ts src/ledger/categories.ts src/ledger/categories.test.ts src/ledger/devices.ts src/ledger/devices.test.ts
git commit -m "feat: 예산 적용·카테고리 이름·기기 안내 계산 함수

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 홈 예산 표시와 숨김 반영 카테고리

**Files:**
- Create: `src/components/ledger/budget-summary.tsx`, `e2e/budget-home.spec.ts`
- Modify: `src/ledger/queries.ts` (`loadCategories`, `loadBudgets` 추가, `loadMonth`), `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: Task 1 `category_hidden`, Task 3 `effectiveBudgets`·`budgetStatus`·`spentByCategory`·`budgetMonth`·`TOTAL`
- Produces:
  ```ts
  // queries.ts
  export async function loadCategories(db): Promise<{ names: Map<string, string>; choices: CategoryLite[]; rows: CategoryRow[]; hiddenIds: Set<string> }>;
  export async function loadBudgets(db: SupabaseClient, month: Month): Promise<Map<string, number>>;
  // MonthData에 추가: budgets: Map<string, number>; warnRatio: number
  ```
  홈 테스트 id: `budget-total`, `budget-category`. 색 토큰 `warning`.

- [ ] **Step 1: 실패하는 e2e 작성**

`e2e/budget-home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { budgetMonth } from "@/ledger/budget";
import { kstMonthOf, shiftMonth } from "@/ledger/month";
import { adminClient, createGroupFixture } from "../tests/helpers/db";
import { at, kstStamp, signIn } from "./support";

const db = adminClient();

test("지난달에 정한 전체 예산이 이번 달에도 이어지고, 80% 넘은 카테고리만 경고로 보인다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-budget");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(2)), receivedAt: new Date(), source: "manual_test" });
  const id = async (name: string) =>
    (await db.from("categories").select("id").is("group_id", null).eq("name", name).single()).data!.id;
  const cafe = await id("카페");
  await db.from("transactions").update({ category_id: cafe, category_source: "user" }).eq("id", r.transactionId!);

  const thisMonth = kstMonthOf(new Date());
  await db.from("budgets").insert([
    { group_id: g.groupId, category_id: null, month: budgetMonth(shiftMonth(thisMonth, -1)), amount: 100000 },
    { group_id: g.groupId, category_id: cafe, month: budgetMonth(thisMonth), amount: 10000 },
    { group_id: g.groupId, category_id: await id("식비"), month: budgetMonth(thisMonth), amount: 100000 },
  ]);

  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("budget-total")).toContainText("87,700원 남음");
  await expect(page.getByTestId("budget-total")).toContainText("예산 100,000원 중 12%");
  await expect(page.getByTestId("budget-category")).toHaveCount(1);
  await expect(page.getByTestId("budget-category")).toHaveText("카페 123% · 2,300원 초과");

  // 지난달: 전체 예산만 있고(카테고리 예산은 이번 달부터) 쓴 돈이 없다
  await page.getByRole("link", { name: "이전 달" }).click();
  await expect(page.getByTestId("budget-total")).toContainText("100,000원 남음");
  await expect(page.getByTestId("budget-category")).toHaveCount(0);
});

test("예산이 하나도 없으면 예산 영역이 없다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-budget-none");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.getByTestId("family-total")).toBeVisible();
  await expect(page.getByTestId("budget-total")).toHaveCount(0);
});
```

`e2e/support.ts`에 시드 시각 도우미를 추가한다(Task 8에서 기존 테스트도 이것으로 바꾼다):

```ts
/** 지금으로부터 minutesAgo분 전의 KST "MM/DD HH:mm". 자정 무렵에도 미래 시각이 되지 않는다. */
export function kstStamp(minutesAgo: number, now = new Date()): string {
  const k = new Date(now.getTime() - minutesAgo * 60_000 + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(k.getUTCMonth() + 1)}/${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/budget-home.spec.ts`
Expected: FAIL (`budget-total` 없음)

- [ ] **Step 3: 데이터 읽기 구현**

`src/ledger/queries.ts`:

import 줄을 바꾼다:

```ts
import { budgetMonth, effectiveBudgets } from "./budget";
import { monthRange, type Month } from "./month";
```

`MonthData`에 두 항목을 추가한다:

```ts
  budgets: Map<string, number>;
  warnRatio: number;
```

`loadCategories`를 바꾸고 `loadBudgets`를 추가한다:

```ts
/** 보이는 카테고리(기본 + 내 그룹, RLS). 버튼용은 숨긴 것을 빼고 이름이 겹치면 그룹 것만. */
export async function loadCategories(db: SupabaseClient) {
  const [rows, hidden] = await Promise.all([
    must<CategoryRow[]>(db.from("categories").select("id, name, group_id").order("sort_order").order("name")),
    must<{ category_id: string }[]>(db.from("category_hidden").select("category_id")),
  ]);
  const hiddenIds = new Set(hidden.map((h) => h.category_id));
  return {
    names: new Map(rows.map((r) => [r.id, r.name])),
    choices: categoryOptions(rows.filter((r) => !hiddenIds.has(r.id))).map(({ id, name }) => ({ id, name })),
    rows,
    hiddenIds,
  };
}

/** 그 달에 적용되는 예산(키: 카테고리 id 또는 TOTAL) */
export async function loadBudgets(db: SupabaseClient, month: Month): Promise<Map<string, number>> {
  const rows = await must<{ category_id: string | null; month: string; amount: number }[]>(
    db.from("budgets").select("category_id, month, amount").lte("month", budgetMonth(month)),
  );
  return effectiveBudgets(
    rows.map((r) => ({ categoryId: r.category_id, month: r.month, amount: Number(r.amount) })),
    month,
  );
}
```

`loadMonth`의 `Promise.all`을 다음으로 바꾼다:

```ts
  const [rows, members, categories, unparsed, budgets, warn] = await Promise.all([
    must<TxRow[]>(
      db.from("transactions").select(TX_COLUMNS)
        .gte("occurred_at", from.toISOString()).lt("occurred_at", to.toISOString())
        .order("occurred_at", { ascending: false }),
    ),
    loadMembers(db, groupId),
    loadCategories(db),
    db.from("raw_messages").select("id", { count: "exact", head: true }).eq("status", "unparsed"),
    loadBudgets(db, month),
    db.from("app_settings").select("value").eq("key", "budget_warning_ratio").single(),
  ]);
  if (unparsed.error) throw unparsed.error;
  if (warn.error) throw warn.error;
```

`return` 객체에 추가:

```ts
    budgets,
    warnRatio: Number(warn.data.value),
```

- [ ] **Step 4: 화면 구현**

`src/app/globals.css`의 `:root`에 `--warning: #ff9500;`, 다크 모드 `:root`에 `--warning: #ff9f0a;`, `@theme inline`에 `--color-warning: var(--warning);`를 추가한다.

`src/components/ledger/budget-summary.tsx`:

```tsx
import { budgetStatus, TOTAL, type BudgetLevel } from "@/ledger/budget";
import { formatWon } from "@/ledger/summary";

const BAR: Record<BudgetLevel, string> = { ok: "bg-accent", warn: "bg-warning", over: "bg-danger" };
const TEXT: Record<BudgetLevel, string> = { ok: "", warn: "text-warning", over: "text-danger" };
const pct = (ratio: number) => Math.round(ratio * 100);
const left = (remaining: number) =>
  remaining >= 0 ? `${formatWon(remaining)}원 남음` : `${formatWon(-remaining)}원 초과`;

/** 홈 예산: 전체 예산 막대 + 경고 기준을 넘은 카테고리만. 예산이 없으면 그리지 않는다. */
export function BudgetSummary({
  budgets, spentTotal, spentByCategory, categoryNames, warnRatio,
}: {
  budgets: Map<string, number>;
  spentTotal: number;
  spentByCategory: Map<string, number>;
  categoryNames: Map<string, string>;
  warnRatio: number;
}) {
  const total = budgets.get(TOTAL);
  const totalStatus = total === undefined ? null : budgetStatus(spentTotal, total, warnRatio);
  const warned = [...budgets]
    .filter(([key]) => key !== TOTAL)
    .map(([key, budget]) => ({ name: categoryNames.get(key) ?? "", ...budgetStatus(spentByCategory.get(key) ?? 0, budget, warnRatio) }))
    .filter((c) => c.level !== "ok")
    .sort((a, b) => b.ratio - a.ratio);
  if (!totalStatus && warned.length === 0) return null;

  return (
    <section className="mt-3">
      {totalStatus && total !== undefined && (
        <div data-testid="budget-total">
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div className={`h-full ${BAR[totalStatus.level]}`} style={{ width: `${Math.min(totalStatus.ratio, 1) * 100}%` }} />
          </div>
          <p className="tabular mt-1 flex justify-between text-sm">
            <span className={TEXT[totalStatus.level]}>{left(totalStatus.remaining)}</span>
            <span className="text-muted">예산 {formatWon(total)}원 중 {pct(totalStatus.ratio)}%</span>
          </p>
        </div>
      )}
      {warned.map((c) => (
        <p key={c.name} data-testid="budget-category" className={`tabular mt-1 text-sm ${TEXT[c.level]}`}>
          {c.name} {pct(c.ratio)}% · {left(c.remaining)}
        </p>
      ))}
    </section>
  );
}
```

`src/app/page.tsx`: import 추가

```tsx
import { BudgetSummary } from "@/components/ledger/budget-summary";
import { spentByCategory } from "@/ledger/budget";
```

`<MonthSummary … />` 바로 다음 줄에:

```tsx
      <BudgetSummary
        budgets={data.budgets}
        spentTotal={sum.total}
        spentByCategory={spentByCategory(data.txs)}
        categoryNames={data.categoryNames}
        warnRatio={data.warnRatio}
      />
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test:e2e e2e/budget-home.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/ledger/queries.ts src/components/ledger/budget-summary.tsx src/app/page.tsx src/app/globals.css e2e/budget-home.spec.ts e2e/support.ts
git commit -m "feat: 홈에 예산 진행률과 경고 카테고리 표시

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 예산 화면

**Files:**
- Create: `src/app/budget/page.tsx`, `src/app/budget/actions.ts`, `src/components/ledger/budget-form.tsx`, `e2e/budget-page.spec.ts`
- Modify: `src/components/app-menu.tsx` (메뉴에 "예산" 링크)

**Interfaces:**
- Consumes: Task 3 `parseBudgetInput`·`budgetMonth`·`TOTAL`·`spentByCategory`, Task 4 `loadMonth`·`loadBudgets`
- Produces: `/budget`; 입력칸 `name="b:<카테고리 id 또는 total>"`, 접근 이름 `"<이름> 예산"`; `saveBudgetsAction(prev, formData): Promise<BudgetFormState>`

- [ ] **Step 1: 실패하는 e2e 작성**

`e2e/budget-page.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { budgetMonth } from "@/ledger/budget";
import { kstMonthOf } from "@/ledger/month";
import { adminClient, createGroupFixture } from "../tests/helpers/db";
import { signIn } from "./support";

const db = adminClient();

test("예산을 정하면 이번 달부터 저장되고, 비우면 0으로 꺼지며, 잘못된 값은 칸 아래에 이유가 나온다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-budget-page");
  const cafe = (await db.from("categories").select("id").is("group_id", null).eq("name", "카페").single()).data!.id;
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByLabel("메뉴").click();
  await page.getByRole("link", { name: "예산" }).click();

  await page.getByLabel("가족 전체 예산").fill("300,000");
  await page.getByLabel("카페 예산").fill("abc");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("0 이상 숫자로 입력해 주세요.");
  await expect(page.getByLabel("가족 전체 예산")).toHaveValue("300,000");

  await page.getByLabel("카페 예산").fill("50000");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("budget-total")).toContainText("예산 300,000원 중 0%");

  const month = budgetMonth(kstMonthOf(new Date()));
  const rows = async () =>
    (await db.from("budgets").select("category_id, month, amount").eq("group_id", g.groupId).order("amount")).data;
  expect(await rows()).toEqual([
    { category_id: cafe, month, amount: 50000 },
    { category_id: null, month, amount: 300000 },
  ]);

  // 카페 칸을 비우면 0(끔), 나머지 칸은 바뀌지 않았으니 그대로
  await page.goto("/budget");
  await expect(page.getByLabel("카페 예산")).toHaveValue("50,000");
  await page.getByLabel("카페 예산").fill("");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByTestId("family-total")).toBeVisible();
  expect(await rows()).toEqual([
    { category_id: cafe, month, amount: 0 },
    { category_id: null, month, amount: 300000 },
  ]);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/budget-page.spec.ts`
Expected: FAIL (메뉴에 "예산" 링크 없음)

- [ ] **Step 3: 서버 액션 구현**

`src/app/budget/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { budgetMonth, parseBudgetInput, TOTAL } from "@/ledger/budget";
import { isUuid } from "@/ledger/forms";
import { kstMonthOf } from "@/ledger/month";
import { loadBudgets } from "@/ledger/queries";
import { loadMe } from "@/lib/session";

export type BudgetFormState = { error?: string; errors?: Record<string, string>; values?: Record<string, string> } | null;

const FAIL = "저장하지 못했습니다. 다시 시도해 주세요.";

/** 바뀐 칸만 이번 달(KST) 1일로 저장한다. 비운 칸은 0(이 달부터 없음). */
export async function saveBudgetsAction(_prev: BudgetFormState, formData: FormData): Promise<BudgetFormState> {
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const inputs = new Map<string, number | null>();
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("b:") || typeof value !== "string") continue;
    const key = name.slice(2);
    if (key !== TOTAL && !isUuid(key)) continue;
    values[name] = value;
    const parsed = parseBudgetInput(value);
    if (parsed.ok) inputs.set(key, parsed.amount);
    else errors[name] = parsed.error;
  }
  if (Object.keys(errors).length > 0) return { errors, values };

  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL, values };
  const month = kstMonthOf(new Date());
  const current = await loadBudgets(supabase, month);

  const rows = [];
  for (const [key, amount] of inputs) {
    const before = current.get(key) ?? null;
    if (amount === before || (amount === null && before === null)) continue;
    rows.push({
      group_id: me.groupId,
      category_id: key === TOTAL ? null : key,
      month: budgetMonth(month),
      amount: amount ?? 0,
    });
  }
  if (rows.length > 0) {
    const { error } = await supabase.from("budgets").upsert(rows, { onConflict: "group_id,category_id,month" });
    if (error) return { error: FAIL, values };
  }
  revalidatePath("/");
  revalidatePath("/budget");
  redirect("/", RedirectType.replace);
}
```

- [ ] **Step 4: 화면 구현**

`src/components/ledger/budget-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { saveBudgetsAction } from "@/app/budget/actions";
import { formatWon } from "@/ledger/summary";

export type BudgetEntry = { key: string; label: string; amount: number | null; spent: number };

export function BudgetForm({ entries }: { entries: BudgetEntry[] }) {
  const [state, formAction, pending] = useActionState(saveBudgetsAction, null);
  const v = state?.values;
  return (
    // 실패하면 입력값으로 폼을 새로 만든다(React 19 폼 초기화 대응)
    <form key={JSON.stringify(v ?? null)} action={formAction} className="flex flex-col">
      <ul className="divide-y divide-line border-y border-line">
        {entries.map((e) => {
          const name = `b:${e.key}`;
          return (
            <li key={e.key} className="flex items-center gap-3 py-3">
              <span className="flex-1">
                {e.label}
                <span className="tabular block text-xs text-muted">이번 달 {formatWon(e.spent)}원 사용</span>
              </span>
              <span className="w-36">
                <input
                  name={name}
                  aria-label={`${e.label} 예산`}
                  inputMode="numeric"
                  placeholder="없음"
                  defaultValue={v?.[name] ?? (e.amount === null ? "" : formatWon(e.amount))}
                  className="tabular w-full rounded-lg bg-surface px-3 py-2 text-right text-base"
                />
                {state?.errors?.[name] && <span role="alert" className="mt-1 block text-xs text-danger">{state.errors[name]}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      {state?.error && <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="mt-4 rounded-xl bg-accent py-3 text-white disabled:opacity-50">저장</button>
    </form>
  );
}
```

`src/app/budget/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { BudgetForm } from "@/components/ledger/budget-form";
import { spentByCategory, TOTAL } from "@/ledger/budget";
import { kstMonthOf, monthLabel } from "@/ledger/month";
import { loadMonth } from "@/ledger/queries";
import { totals } from "@/ledger/summary";
import { loadMe } from "@/lib/session";

export default async function BudgetPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const month = kstMonthOf(new Date());
  const data = await loadMonth(supabase, me.groupId, month);
  const spent = spentByCategory(data.txs);
  const entries = [
    { key: TOTAL, label: "가족 전체", amount: data.budgets.get(TOTAL) ?? null, spent: totals(data.txs, data.members).total },
    ...data.categoryChoices.map((c) => ({ key: c.id, label: c.name, amount: data.budgets.get(c.id) ?? null, spent: spent.get(c.id) ?? 0 })),
  ];

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">‹ 홈</Link>
        <h1 className="font-semibold">예산</h1>
        <span className="w-8" />
      </header>
      <p className="mb-4 text-sm text-muted">
        {monthLabel(month)} · 저장하면 이번 달부터 적용되고 다음 달에도 이어집니다. 비우면 예산이 없습니다.
      </p>
      <BudgetForm entries={entries} />
    </main>
  );
}
```

`src/components/app-menu.tsx`의 `<Link className={item} href="/group">그룹</Link>` 바로 위에 추가:

```tsx
        <Link className={item} href="/budget">예산</Link>
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test:e2e e2e/budget-page.spec.ts e2e/budget-home.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/app/budget src/components/ledger/budget-form.tsx src/components/app-menu.tsx e2e/budget-page.spec.ts
git commit -m "feat: 예산 화면(한 번 정하면 매달 이어짐)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 카테고리·규칙 관리 화면

**Files:**
- Create: `src/app/categories/page.tsx`, `src/app/categories/actions.ts`, `src/components/categories/name-form.tsx`, `e2e/categories.spec.ts`
- Modify: `src/components/app-menu.tsx` (메뉴에 "카테고리" 링크)

**Interfaces:**
- Consumes: Task 1 `category_hidden`·이름 고유 인덱스, Task 3 `validateCategoryName`, Task 4 `loadCategories`, 3-1 `ActionButton`·`ActionState`
- Produces: `/categories`; 액션 `addCategoryAction(prev, fd)`, `renameCategoryAction(categoryId, prev, fd)`, `deleteCategoryAction(categoryId)`, `setHiddenAction(categoryId, hidden)`, `deleteRuleAction(ruleId)`

- [ ] **Step 1: 실패하는 e2e 작성**

`e2e/categories.spec.ts`:

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/categories.spec.ts`
Expected: FAIL (`/categories` 404)

- [ ] **Step 3: 서버 액션 구현**

`src/app/categories/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/tx-actions";
import { validateCategoryName } from "@/ledger/categories";
import { loadMe } from "@/lib/session";

const FAIL = "저장하지 못했습니다. 다시 시도해 주세요.";

function refresh() {
  revalidatePath("/categories");
  revalidatePath("/");
  revalidatePath("/budget");
}

/** 지금 보이는 모든 카테고리 이름(기본 + 우리 그룹), 바꾸는 중인 것은 뺀다 */
async function takenNames(exceptId?: string): Promise<string[]> {
  const { supabase } = await loadMe();
  const { data, error } = await supabase.from("categories").select("id, name");
  if (error) throw error;
  return data.filter((c) => c.id !== exceptId).map((c) => c.name);
}

export async function addCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("name") ?? "");
  const checked = validateCategoryName(raw, await takenNames());
  if (!checked.ok) return { error: checked.error, values: { name: raw } };
  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL, values: { name: raw } };
  const { data: last } = await supabase.from("categories").select("sort_order")
    .eq("group_id", me.groupId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("categories").insert({
    group_id: me.groupId, name: checked.name, sort_order: Math.max(10, (last?.sort_order ?? 9) + 1),
  });
  if (error) return { error: error.code === "23505" ? "이미 있는 이름입니다." : FAIL, values: { name: raw } };
  refresh();
  return null;
}

export async function renameCategoryAction(categoryId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const raw = String(formData.get("name") ?? "");
  const checked = validateCategoryName(raw, await takenNames(categoryId));
  if (!checked.ok) return { error: checked.error, values: { name: raw } };
  const { supabase, me } = await loadMe();
  const { data, error } = await supabase.from("categories").update({ name: checked.name })
    .eq("id", categoryId).eq("group_id", me.groupId ?? "").select("id");
  if (error) return { error: error.code === "23505" ? "이미 있는 이름입니다." : FAIL, values: { name: raw } };
  if (data.length === 0) return { error: FAIL, values: { name: raw } };
  refresh();
  return null;
}

/** 거래는 미지정(트리거가 출처도 비움), 규칙·예산은 FK로 함께 삭제된다. */
export async function deleteCategoryAction(categoryId: string): Promise<ActionState> {
  const { supabase, me } = await loadMe();
  const { data, error } = await supabase.from("categories").delete()
    .eq("id", categoryId).eq("group_id", me.groupId ?? "").select("id");
  if (error || data.length === 0) return { error: FAIL };
  refresh();
  return null;
}

export async function setHiddenAction(categoryId: string, hidden: boolean): Promise<ActionState> {
  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL };
  const { error } = hidden
    ? await supabase.from("category_hidden").upsert({ group_id: me.groupId, category_id: categoryId }, { ignoreDuplicates: true })
    : await supabase.from("category_hidden").delete().eq("group_id", me.groupId).eq("category_id", categoryId);
  if (error) return { error: FAIL };
  refresh();
  return null;
}

export async function deleteRuleAction(ruleId: string): Promise<ActionState> {
  const { supabase } = await loadMe();
  const { data, error } = await supabase.from("merchant_rules").delete().eq("id", ruleId).select("id");
  if (error || data.length === 0) return { error: FAIL };
  refresh();
  return null;
}
```

- [ ] **Step 4: 화면 구현**

`src/components/categories/name-form.tsx`(추가·이름 바꾸기 공용):

```tsx
"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/tx-actions";

export function NameForm({
  action, label, defaultName = "", button,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  defaultName?: string;
  button: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form key={JSON.stringify(state?.values ?? null)} action={formAction} className="flex flex-1 flex-col">
      <div className="flex gap-2">
        <input
          name="name"
          aria-label={label}
          defaultValue={state?.values?.name ?? defaultName}
          className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-base"
        />
        <button disabled={pending} className="shrink-0 text-accent disabled:opacity-50">{button}</button>
      </div>
      {state?.error && <p role="alert" className="mt-1 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
```

`src/app/categories/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { NameForm } from "@/components/categories/name-form";
import { loadCategories } from "@/ledger/queries";
import { loadMe } from "@/lib/session";
import {
  addCategoryAction, deleteCategoryAction, deleteRuleAction, renameCategoryAction, setHiddenAction,
} from "./actions";

export default async function CategoriesPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const [categories, rules] = await Promise.all([
    loadCategories(supabase),
    supabase.from("merchant_rules").select("id, merchant_pattern, category_id").order("merchant_pattern"),
  ]);
  if (rules.error) throw rules.error;
  const defaults = categories.rows.filter((c) => c.group_id === null);
  const mine = categories.rows.filter((c) => c.group_id !== null);
  const section = "mt-6 mb-2 text-xs font-semibold text-muted";
  const list = "divide-y divide-line border-y border-line";

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">‹ 홈</Link>
        <h1 className="font-semibold">카테고리</h1>
        <span className="w-8" />
      </header>

      <h2 className={section}>기본 카테고리</h2>
      <ul className={list}>
        {defaults.map((c) => {
          const hidden = categories.hiddenIds.has(c.id);
          return (
            <li key={c.id} data-testid={`default-${c.name}`} className="flex items-center justify-between py-3">
              <span className={hidden ? "text-muted" : ""}>{c.name}</span>
              <ActionButton action={setHiddenAction.bind(null, c.id, !hidden)} label={hidden ? "보이기" : "숨기기"} className="text-accent" />
            </li>
          );
        })}
      </ul>

      <h2 className={section}>우리 카테고리</h2>
      <ul className={list}>
        {mine.map((c) => (
          <li key={c.id} data-testid="group-category" className="flex items-start gap-3 py-3">
            <NameForm action={renameCategoryAction.bind(null, c.id)} label={`${c.name} 새 이름`} defaultName={c.name} button="저장" />
            <ActionButton
              action={deleteCategoryAction.bind(null, c.id)}
              label="삭제"
              confirmText="삭제하면 이 카테고리의 거래는 미지정이 되고, 관련 가맹점 규칙과 예산도 지워집니다."
              className="text-danger"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <NameForm action={addCategoryAction} label="새 카테고리 이름" button="추가" />
      </div>

      <h2 className={section}>가맹점 규칙</h2>
      {rules.data.length === 0 ? (
        <p className="py-3 text-sm text-muted">거래의 카테고리를 고르면 여기에 규칙이 생깁니다.</p>
      ) : (
        <ul className={list}>
          {rules.data.map((r) => (
            <li key={r.id} data-testid="rule" className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.merchant_pattern} → {categories.names.get(r.category_id) ?? ""}</span>
              <ActionButton action={deleteRuleAction.bind(null, r.id)} label="삭제" confirmText="이 규칙을 지울까요?" className="text-danger" />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

`src/components/app-menu.tsx`의 "예산" 링크 다음 줄에 추가:

```tsx
        <Link className={item} href="/categories">카테고리</Link>
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test:e2e e2e/categories.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/app/categories src/components/categories src/components/app-menu.tsx e2e/categories.spec.ts
git commit -m "feat: 카테고리 숨기기·추가·이름 바꾸기·삭제와 가맹점 규칙 관리

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 기기 연결 안내

**Files:**
- Create: `src/components/devices/device-setup.tsx`, `src/components/devices/copy-field.tsx`, `e2e/devices.spec.ts`
- Modify: `src/app/devices/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: Task 3 `parseDevice`·`deviceGuide`·`DEVICE_STEPS`·`DEVICE_LABEL`·`tokenHealth`; 기존 `issueTokenAction`·`revokeTokenAction`(`src/app/devices/actions.ts`), `SecretState`
- Produces: `/devices?device=iphone|android`; 복사 입력칸 test id `copy-url`, `copy-header`, `copy-body`; 발급 토큰 `token-value`

- [ ] **Step 1: 실패하는 e2e 작성**

`e2e/devices.spec.ts`:

```ts
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
```

두 번째 테스트의 `update`는 첫 토큰만 바꾸도록, 두 번째 토큰을 발급하기 전에 실행한다(위 순서 그대로).

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/devices.spec.ts`
Expected: FAIL (탭 링크 없음)

- [ ] **Step 3: 구현**

`src/components/devices/copy-field.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";

/** 읽기 전용 값과 [복사]. 클립보드가 막히면 값을 선택해 두고 길게 눌러 복사하라고 안내한다. */
export function CopyField({ label, value, testId }: { label: string; value: string; testId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="py-2">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          readOnly
          value={value}
          data-testid={testId}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 font-mono text-base"
        />
        <button
          type="button"
          className="shrink-0 text-accent"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setMessage("복사됨");
            } catch {
              input.current?.select();
              setMessage("길게 눌러 복사해 주세요.");
            }
          }}
        >
          복사
        </button>
      </div>
      {message && <p role="status" className="mt-1 text-xs text-muted">{message}</p>}
    </div>
  );
}
```

`src/components/devices/device-setup.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { issueTokenAction } from "@/app/devices/actions";
import { DEVICE_LABEL, DEVICE_STEPS, deviceGuide, type Device } from "@/ledger/devices";
import { CopyField } from "./copy-field";

/** 토큰 발급 → 기종별 안내 → 복사할 값. 발급 직후에는 헤더 값에 실제 토큰이 들어간다. */
export function DeviceSetup({ device, appUrl }: { device: Device; appUrl: string }) {
  const [state, formAction, pending] = useActionState(issueTokenAction, null);
  const guide = deviceGuide(device, appUrl, state?.value ?? null);
  const heading = "mt-6 mb-2 font-semibold";
  return (
    <>
      <h2 className={heading}>1. 토큰 발급</h2>
      <form action={formAction} className="flex gap-2">
        <input name="label" placeholder={`기기 이름 (예: 내 ${DEVICE_LABEL[device]})`} className="min-w-0 flex-1 rounded-lg bg-surface px-3 py-2 text-base" />
        <button disabled={pending} className="shrink-0 rounded-lg bg-accent px-4 text-white disabled:opacity-50">토큰 발급</button>
      </form>
      {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
      {state?.value && (
        <div className="mt-3 rounded-xl border border-warning p-3">
          <p className="mb-1 text-sm">기기 토큰 — 이 화면을 벗어나면 다시 볼 수 없습니다. 아래 헤더 값에 이미 들어 있습니다.</p>
          <input readOnly value={state.value} data-testid="token-value" onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg bg-surface px-3 py-2 font-mono text-base" />
        </div>
      )}

      <h2 className={heading}>2. {DEVICE_LABEL[device]} 설정</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {DEVICE_STEPS[device].map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="mt-2 text-xs text-muted">휴대폰·앱 버전에 따라 메뉴 이름이 조금 다를 수 있습니다.</p>

      <h2 className={heading}>3. 복사할 값</h2>
      <CopyField label="주소" value={guide.url} testId="copy-url" />
      <CopyField label="헤더 Authorization" value={guide.headerValue} testId="copy-header" />
      <CopyField label="보낼 내용" value={guide.body} testId="copy-body" />
    </>
  );
}
```

`src/app/devices/page.tsx` 전체:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeviceSetup } from "@/components/devices/device-setup";
import { DEVICE_LABEL, parseDevice, tokenHealth, type Device } from "@/ledger/devices";
import { loadMe } from "@/lib/session";
import { revokeTokenAction } from "./actions";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음");
const HEALTH_TEXT = {
  never: "아직 받은 문자가 없습니다.",
  stale: "3일 넘게 문자가 오지 않았습니다. 설정을 확인해 주세요.",
  ok: null,
} as const;

export default async function DevicesPage({ searchParams }: PageProps<"/devices">) {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const device = parseDevice((await searchParams).device);
  const { data: tokens } = await supabase
    .from("ingest_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">‹ 홈</Link>
        <h1 className="font-semibold">내 기기 연결</h1>
        <span className="w-8" />
      </header>
      <nav className="grid grid-cols-2 rounded-xl bg-surface p-1 text-center text-sm">
        {(["iphone", "android"] as Device[]).map((d) => (
          <Link
            key={d}
            href={`/devices?device=${d}`}
            replace
            aria-current={d === device ? "page" : undefined}
            className={`rounded-lg py-2 ${d === device ? "bg-background font-semibold shadow" : "text-muted"}`}
          >
            {DEVICE_LABEL[d]}
          </Link>
        ))}
      </nav>

      {/* 탭마다 새로 그려 발급 상태가 다른 기종으로 넘어가지 않게 한다 */}
      <DeviceSetup key={device} device={device} appUrl={process.env.APP_URL ?? ""} />

      <h2 className="mt-8 mb-2 font-semibold">내 기기</h2>
      <ul className="flex flex-col gap-2 text-sm">
        {(tokens ?? []).map((t) => {
          const health = t.revoked_at ? null : HEALTH_TEXT[tokenHealth(t.last_used_at, now)];
          return (
            <li key={t.id} className="rounded-xl bg-surface p-3">
              <div className="font-semibold">
                {t.label || "(이름 없음)"} {t.revoked_at && <span className="text-danger">폐기됨</span>}
              </div>
              <div className="text-muted">발급 {fmt(t.created_at)} · 마지막 수신 {fmt(t.last_used_at)}</div>
              {health && <p className="mt-1 text-warning">{health}</p>}
              {!t.revoked_at && (
                <form action={revokeTokenAction.bind(null, t.id)} className="mt-1">
                  <button className="text-danger">폐기</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test:e2e e2e/devices.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add src/app/devices/page.tsx src/components/devices e2e/devices.spec.ts
git commit -m "feat: 기종 탭으로 고르는 기기 연결 안내와 복사 버튼, 3일 수신 경고

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 3-1에서 미룬 사소한 문제

**Files:**
- Create: `src/components/ledger/modal-sheet.tsx`, `e2e/minor-fixes.spec.ts`
- Modify: `src/app/unparsed/actions.ts`, `src/app/tx-actions.ts`, `src/components/ledger/tx-sheet.tsx`, `src/components/app-menu.tsx`, `e2e/home.spec.ts`, `e2e/category.spec.ts`, `e2e/review-fixes.spec.ts`, `e2e/support.ts`

**Interfaces:**
- Consumes: 3-1 `ActionState`, `TxSheet`, `AppMenu`; Task 4 `kstStamp`
- Produces: `ModalSheet({ label, closeHref, children })`(client); `AppMenu`는 client 컴포넌트(props 그대로)

- [ ] **Step 1: 실패하는 e2e 작성**

`e2e/minor-fixes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { APPROVAL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture } from "../tests/helpers/db";
import { at, kstStamp, signIn } from "./support";

const db = adminClient();

test("이미 처리된 문자는 무시·등록할 수 없고 거래도 만들지 않는다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-raw-done");
  await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: UNKNOWN_KB, receivedAt: new Date(), source: "manual_test" });
  const { data: raw } = await db.from("raw_messages").select("id").eq("group_id", g.groupId).single();
  await signIn(context, g.owner.email);

  await page.goto(`/new?raw=${raw!.id}`);
  await db.from("raw_messages").update({ status: "ignored" }).eq("id", raw!.id); // 다른 사람이 먼저 처리
  await page.getByLabel("금액").fill("1000");
  await page.getByLabel("가맹점").fill("카드 결제");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("이미 처리된 문자입니다.");
  expect((await db.from("transactions").select("id").eq("group_id", g.groupId)).data).toEqual([]);

  await db.from("raw_messages").update({ status: "unparsed" }).eq("id", raw!.id);
  await page.goto("/unparsed");
  await db.from("raw_messages").update({ status: "parsed" }).eq("id", raw!.id);
  await page.getByRole("button", { name: "무시" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("이미 처리된 문자입니다.");
  expect((await db.from("raw_messages").select("status").eq("id", raw!.id).single()).data).toEqual({ status: "parsed" });
});

test("이미 지워진 거래를 삭제하면 오류를 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-del-gone");
  const { data: tx } = await db.from("transactions").insert({
    group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 5000,
    merchant: "시장", occurred_at: new Date(Date.now() - 60_000).toISOString(),
  }).select("id").single();
  await signIn(context, g.owner.email);
  page.on("dialog", (d) => d.accept());
  await page.goto(`/?tx=${tx!.id}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await sheet.getByText("더 보기").click();
  await db.from("transactions").delete().eq("id", tx!.id);
  await sheet.getByRole("button", { name: "삭제" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("저장하지 못했습니다. 다시 시도해 주세요.");
});

test("시트는 모달로 포커스를 받고 배경 스크롤을 잠그며, 메뉴는 바깥을 탭하면 닫힌다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-a11y");
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: at(APPROVAL, kstStamp(2)), receivedAt: new Date(), source: "manual_test" });
  await signIn(context, g.owner.email);

  await page.goto(`/?tx=${r.transactionId}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  await expect(sheet).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.getByRole("link", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

  await page.getByLabel("메뉴").click();
  await expect(page.getByRole("link", { name: "그룹" })).toBeVisible();
  await page.getByTestId("family-total").click();
  await expect(page.getByRole("link", { name: "그룹" })).toBeHidden();
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/minor-fixes.spec.ts`
Expected: FAIL (처리된 문자도 등록됨, 삭제 오류 없음, `aria-modal` 없음)

- [ ] **Step 3: 구현**

`src/app/unparsed/actions.ts`의 `ignoreRawAction` 본문:

```ts
export async function ignoreRawAction(rawId: string): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("raw_messages").update({ status: "ignored" })
    .eq("id", rawId).eq("status", "unparsed").select("id");
  if (error) return { error: "저장하지 못했습니다. 다시 시도해 주세요." };
  if (data.length === 0) return { error: "이미 처리된 문자입니다." };
  revalidatePath("/unparsed");
  revalidatePath("/");
  return null;
}
```

`src/app/tx-actions.ts`:

`deleteTxAction`의 삭제 줄과 오류 처리를 다음으로 바꾼다:

```ts
  const { data, error } = await supabase.from("transactions").delete()
    .eq("id", txId).eq("kind", "manual").select("id");
  if (error || data.length === 0) return { error: FAIL };
```

`createTxAction`에서 `const v = parsed.value;` 바로 다음에(거래를 넣기 전에) 추가:

```ts
  const rawId = text(formData, "rawId");
  if (isUuid(rawId)) {
    const { data: raw } = await supabase.from("raw_messages").select("id").eq("id", rawId).eq("status", "unparsed").maybeSingle();
    if (!raw) return { error: "이미 처리된 문자입니다.", values: valuesOf(formData) };
  }
```

그리고 아래쪽의 `const rawId = text(formData, "rawId");` 줄을 지우고, 문자 상태 변경 줄을 다음으로 바꾼다:

```ts
    const { error: rawError } = await supabase.from("raw_messages").update({ status: "parsed" })
      .eq("id", rawId).eq("status", "unparsed");
```

`src/components/ledger/modal-sheet.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

/** 아래에서 올라오는 모달 시트: 열리면 시트로 포커스, 열려 있는 동안 배경 스크롤 잠금. */
export function ModalSheet({ label, closeHref, children }: { label: string; closeHref: string; children: ReactNode }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      <Link href={closeHref} scroll={false} replace aria-label="닫기" className="absolute inset-0 bg-black/30" />
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative mx-auto max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-background p-4 pb-10 outline-none"
      >
        {children}
      </section>
    </div>
  );
}
```

`src/components/ledger/tx-sheet.tsx`: `import Link from "next/link";`를 `import { ModalSheet } from "./modal-sheet";`로 바꾸고, 바깥 `<div className="fixed …">`·닫기 `<Link>`·`<section …>`을 `<ModalSheet label="거래 수정" closeHref={closeHref}>`로 감싼 형태로 바꾼다:

```tsx
  return (
    <ModalSheet label="거래 수정" closeHref={closeHref}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="truncate font-semibold">{tx.merchant}</h2>
        <span className="tabular shrink-0">{formatWon(tx.amount)}원</span>
      </div>
      {/* CategoryPicker 이하 기존 내용 그대로 */}
    </ModalSheet>
  );
```

`src/components/app-menu.tsx` 전체(바깥 탭으로 닫힘, Task 5·6 링크 포함):

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/session";

export function AppMenu({ me }: { me: Me }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const details = menu.current;
      if (details?.open && !details.contains(e.target as Node)) details.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const item = "rounded-lg px-3 py-2 active:bg-line";
  return (
    <details ref={menu} className="relative">
      <summary aria-label="메뉴" className="cursor-pointer list-none px-1 text-xl [&::-webkit-details-marker]:hidden">☰</summary>
      <nav className="absolute left-0 z-10 mt-2 flex w-48 flex-col rounded-xl bg-surface p-1 shadow-lg">
        <span className="px-3 py-2 text-sm text-muted">{me.displayName}님</span>
        <Link className={item} href="/budget">예산</Link>
        <Link className={item} href="/categories">카테고리</Link>
        <Link className={item} href="/group">그룹</Link>
        <Link className={item} href="/devices">내 기기 연결</Link>
        {me.isOperator && <Link className={item} href="/operator">운영자</Link>}
        <form action={signOut}>
          <button className={`${item} w-full text-left text-danger`}>로그아웃</button>
        </form>
      </nav>
    </details>
  );
}
```

시드 시각: `e2e/home.spec.ts`, `e2e/category.spec.ts`, `e2e/review-fixes.spec.ts`에서 `` `${day} 00:01` ``·`` `${todayMmdd()} 00:01` ``는 `kstStamp(3)`, `00:02`는 `kstStamp(2)`, `00:03`은 `kstStamp(1)`로 바꾸고, import의 `todayMmdd`를 `kstStamp`로 바꾼다(`const day = todayMmdd();` 줄 삭제). `e2e/support.ts`에서 쓰이지 않게 된 `todayMmdd`를 지운다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test:e2e`
Expected: PASS (전체)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add src/app/unparsed/actions.ts src/app/tx-actions.ts src/components/ledger/modal-sheet.tsx src/components/ledger/tx-sheet.tsx src/components/app-menu.tsx e2e
git commit -m "fix: 처리된 문자 재처리 차단·삭제 실패 표시·시트 접근성·메뉴 닫기·e2e 시드 시각

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 범위 밖

- 통계 화면(사용자 결정으로 제외)
- 갤럭시 문자 줄바꿈이 JSON을 깨뜨리는 경우의 ingest 형식 확장(실기기 확인 후)
- 계획 4(NAS 배포): 이 계획이 끝나면 사용자에게 다시 물어보고 시작한다
