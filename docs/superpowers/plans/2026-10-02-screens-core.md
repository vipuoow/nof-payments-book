# 가계부 핵심 화면 (계획 3-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부부가 앱을 열면 이번 달 합계와 거래가 한 화면에 보이고, 거래를 탭해 카테고리를 고치면 가맹점 규칙으로 학습되며, 수동 입력과 미분류 문자 처리를 할 수 있게 한다.

**Architecture:** 화면은 서버 컴포넌트가 로그인 사용자 권한(RLS)으로 데이터를 읽고, 수정은 서버 액션으로 한다. 클라이언트 컴포넌트는 `useActionState` 폼(오류 표시)에만 쓴다. 날짜·합계·폼 검증은 프레임워크와 무관한 순수 함수(`src/ledger`)에 두고 단위 테스트한다. 카테고리 수정·규칙 학습·같은 달 일괄 변경은 DB 함수 하나(`set_transaction_category`)에서 원자적으로 처리한다. 화면 흐름은 Playwright(WebKit, iPhone 13)로 확인한다.

**Tech Stack:** Next.js 16(App Router, 서버 액션, `manifest.ts`, `apple-icon.tsx`), React 19, Tailwind CSS 4, @supabase/ssr, Zod, Vitest, Playwright(@playwright/test, WebKit), 로컬 Supabase

**Spec:** `docs/superpowers/specs/2026-10-02-screens-core-design.md` (상위: `docs/superpowers/specs/2026-10-01-nof-payments-book-design.md`)

## Global Constraints

- 작업 원칙: **각 Task 시작 전과 모든 커밋 전에 사용자 승인**을 받는다. 설치(Playwright, 브라우저 엔진)는 승인됨(2026-10-02).
- 공개 저장소: 실제 문자·이름·주소·비밀값을 커밋하지 않는다. 테스트 데이터는 가상 값만 쓴다. 커밋 전 `.githooks/pre-commit`(gitleaks + 로컬 키 값 대조)이 통과해야 한다.
- 화면의 읽기·쓰기는 로그인 사용자 권한(`createSupabaseServerClient`, RLS)으로 한다. 화면 코드에서 `service_role`을 쓰지 않는다.
- 이 Next.js는 학습 데이터와 다르다. 새 API를 쓰기 전 `node_modules/next/dist/docs/`의 해당 문서를 읽는다. `searchParams`는 `Promise`이고, `PageProps<'/경로'>`는 전역 타입이다.
- 시간대: 월 범위·날짜 묶기·일시 입력은 한국 시간(KST, UTC+9)이다.
- 디자인: 아이폰 기본 앱 느낌. 시스템 글꼴, 회색 구분선, 강조색 하나, 다크 모드는 휴대폰 설정을 따름. 화면 폭 최대 480px. 문구는 한국어 존댓말, 짧게.
- 저장 실패 문구: `저장하지 못했습니다. 다시 시도해 주세요.`
- 검증: 매 Task 끝에 `pnpm test`, `pnpm test:db`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm secrets:scan`을 모두 실행한다. Task 3부터는 `pnpm test:e2e`도 실행한다. DB·화면 테스트는 로컬 Supabase가 켜져 있어야 한다(`supabase start`).
- 로컬 DB에 마이그레이션은 `supabase migration up --local`로 적용한다(`supabase db reset`은 로컬 데이터를 지우므로 쓰지 않는다).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.

## Review Focus

1. **한국 시간 월말 자정 경계**: KST 10월 1일 00:30(UTC 9월 30일 15:30) 결제는 10월 거래이고, 홈의 10월 합계와 "10월 1일 (목)" 묶음에 들어가야 한다. 카테고리 일괄 변경의 "같은 달"도 KST 기준이어야 한다. → Task 1(DB 경계 테스트), Task 2(단위 테스트)
2. **이미 사용자가 고른 거래가 있는 가맹점을 다시 고칠 때**: 사용자가 직접 고른 같은 가맹점 거래는 바뀌지 않아야 한다(사용자 선택이 학습보다 우선). → Task 1 테스트
3. **다른 그룹 거래 id를 주소(`?tx=`)에 넣는 경우**: 시트가 열리지 않고, 카테고리 변경 함수를 직접 불러도 거부돼야 한다. → Task 1(DB 거부), Task 4(e2e: 다른 그룹 tx로 열면 시트 없음)
4. **금액 입력 형식**: "12,300", "12300원", " 5000 "은 받아들이고, "0", "-5", "1.5", "abc", 빈칸은 이유와 함께 막아야 한다. 날짜 "2026-02-30T10:00"은 막아야 한다. → Task 2 테스트
5. **미분류 문자를 거래로 등록한 뒤**: 홈의 "확인할 문자" 줄이 사라지고, 같은 문자가 미분류 목록에 다시 나오지 않아야 한다. → Task 6 e2e

## 스펙과 다르게 구체화한 부분

- 스펙 6장은 화면 테스트를 "Playwright 1개 흐름"으로 정했지만, 화면 Task마다 먼저 실패하는 테스트를 두기 위해 e2e 파일을 Task 3~6에 하나씩 둔다. 스펙의 핵심 흐름(카테고리 변경 → 같은 가맹점도 바뀜)은 Task 5의 e2e다.
- 카테고리 버튼은 기본 + 그룹 카테고리 중 이름이 겹치면 그룹 것만 보여 준다(`categoryOptions` 재사용). 거래 줄의 카테고리 이름은 겹침과 관계없이 그 거래의 `category_id` 이름을 그대로 보여 준다.
- 사람별 합계는 현재 그룹 구성원만 보여 준다(가족 합계에는 모든 거래가 들어간다).
- React 19는 서버 액션이 끝나면 폼을 초기화한다. 검증·저장에 실패하면 액션이 입력값(`values`)을 돌려주고 폼이 그 값으로 다시 채운다(스펙 5장 "입력값과 화면은 그대로").
- 3-1 스펙 3.1의 화면 예시 요일 "10월 2일 (목)"은 실제로 금요일이다. Task 1에서 예시를 "(금)"으로 고친다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20261002000100_ledger_screens.sql` | `set_transaction_category`, `ingest_sms`(취소 먼저 도착 연결) |
| `src/ledger/month.ts` | KST 월·날짜 계산, `month` 쿼리 해석, datetime-local 변환 |
| `src/ledger/summary.ts` | `LedgerTx`·`Member` 타입, 합계, 날짜별 묶기, 금액 표기 |
| `src/ledger/forms.ts` | 거래 폼 검증(`parseTxForm`), `isUuid` |
| `src/ledger/queries.ts` | 화면용 DB 읽기(월 데이터, 거래 하나, 구성원, 카테고리, 원문) |
| `src/app/globals.css`, `src/app/layout.tsx` | 디자인 토큰, 시스템 글꼴, viewport·PWA 메타 |
| `src/app/manifest.ts`, `src/app/icon.svg`, `src/app/apple-icon.tsx` | PWA 매니페스트·아이콘 |
| `src/auth/paths.ts` | 매니페스트·아이콘을 로그인 없이 열기 |
| `src/app/page.tsx` | 홈(합계 + 월별 거래 + 시트) |
| `src/components/app-menu.tsx`, `src/components/no-group.tsx` | 메뉴, 그룹 없는 사용자 화면 |
| `src/components/ledger/*.tsx` | 월 요약, 날짜별 목록, 거래 시트, 카테고리 버튼, 수정·입력 폼, 확인 버튼 |
| `src/app/tx-actions.ts` | 카테고리 변경·거래 수정·삭제·수동 입력 서버 액션 |
| `src/app/new/page.tsx` | 수동 입력(미분류 문자 등록 포함) |
| `src/app/unparsed/page.tsx`, `src/app/unparsed/actions.ts` | 미분류 문자 목록과 무시 |
| `playwright.config.ts`, `e2e/*.ts` | 화면 테스트 설정·도우미·테스트 |
| `tests/helpers/db.ts` | 테스트 사용자에 `email` 추가, `PASSWORD` 내보내기 |
| `tests/db/ledger.db.test.ts` | DB 함수 테스트 |

---

### Task 1: 카테고리 수정 함수와 취소 먼저 도착 연결 (DB)

**Files:**
- Create: `supabase/migrations/20261002000100_ledger_screens.sql`
- Test: `tests/db/ledger.db.test.ts`
- Modify: `docs/superpowers/specs/2026-10-01-nof-payments-book-design.md` (4장 `raw_messages` 행), `docs/superpowers/specs/2026-10-02-screens-core-design.md` (3.1 예시 요일)

**Interfaces:**
- Produces: RPC `set_transaction_category(p_transaction uuid, p_category uuid) returns int`(함께 바뀐 다른 거래 수). 권한 없음은 예외 메시지 `not_allowed`, 로그인 안 함은 `not_authenticated`. `ingest_sms`는 승인 저장 시 먼저 온 취소를 연결한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/db/ledger.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, anonClient, createGroupFixture, type GroupFixture } from "../helpers/db";

const db = adminClient();
const received = new Date("2026-10-02T13:00:00+09:00");
const at = (body: string, mmdd_hhmm: string) => body.replace(/\d{2}\/\d{2} \d{2}:\d{2}/, mmdd_hhmm);

async function categoryId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function ingest(g: GroupFixture, body: string, receivedAt = received): Promise<string> {
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body, receivedAt, source: "manual_test" });
  return r.transactionId!;
}

async function tx(id: string) {
  const { data, error } = await db.from("transactions")
    .select("category_id, category_source, cancels_transaction_id").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("set_transaction_category", () => {
  it("고른 거래는 user, 규칙 저장, 같은 달 같은 가맹점의 미지정·ai 거래는 rule로 함께 바뀐다", async () => {
    const cafe = await categoryId("카페");
    const food = await categoryId("식비");
    const g = await createGroupFixture("set-cat");
    const target = await ingest(g, at(APPROVAL, "10/02 08:26"));
    const sameNull = await ingest(g, at(APPROVAL, "10/01 00:30"));   // KST 10/1 00:30 = UTC 9/30 15:30
    const sameAi = await ingest(g, at(APPROVAL, "10/02 12:00"));
    const sameUser = await ingest(g, at(APPROVAL, "10/02 12:10"));
    const prevMonth = await ingest(g, at(APPROVAL, "09/30 23:50"));
    await db.from("transactions").update({ category_id: food, category_source: "ai" }).eq("id", sameAi);
    await g.member.client.from("transactions").update({ category_id: food }).eq("id", sameUser); // 트리거가 user로

    const { data, error } = await g.owner.client.rpc("set_transaction_category", { p_transaction: target, p_category: cafe });
    expect(error).toBeNull();
    expect(data).toBe(2);

    expect(await tx(target)).toMatchObject({ category_id: cafe, category_source: "user" });
    expect(await tx(sameNull)).toMatchObject({ category_id: cafe, category_source: "rule" });
    expect(await tx(sameAi)).toMatchObject({ category_id: cafe, category_source: "rule" });
    expect(await tx(sameUser)).toMatchObject({ category_id: food, category_source: "user" });
    expect(await tx(prevMonth)).toMatchObject({ category_id: null, category_source: null });

    const { data: rule } = await db.from("merchant_rules").select("category_id")
      .eq("group_id", g.groupId).eq("merchant_pattern", "테스트커피 강남역점(메가").single();
    expect(rule!.category_id).toBe(cafe);
  });

  it("다시 고치면 규칙이 갱신되고, 미지정으로 되돌리면 그 거래만 바뀌고 규칙은 남는다", async () => {
    const cafe = await categoryId("카페");
    const food = await categoryId("식비");
    const g = await createGroupFixture("set-cat-again");
    const id = await ingest(g, at(APPROVAL, "10/02 08:26"));

    await g.owner.client.rpc("set_transaction_category", { p_transaction: id, p_category: cafe });
    await g.owner.client.rpc("set_transaction_category", { p_transaction: id, p_category: food });
    const rule = () => db.from("merchant_rules").select("category_id").eq("group_id", g.groupId).single();
    expect((await rule()).data!.category_id).toBe(food);

    const { data, error } = await g.owner.client.rpc("set_transaction_category", { p_transaction: id, p_category: null });
    expect(error).toBeNull();
    expect(data).toBe(0);
    expect(await tx(id)).toMatchObject({ category_id: null, category_source: null });
    expect((await rule()).data!.category_id).toBe(food);
  });

  it("다른 그룹의 거래나 카테고리는 거부하고, 로그인하지 않으면 실행할 수 없다", async () => {
    const cafe = await categoryId("카페");
    const mine = await createGroupFixture("set-cat-mine");
    const other = await createGroupFixture("set-cat-other");
    const myTx = await ingest(mine, at(APPROVAL, "10/02 08:26"));
    const { data: otherCat } = await db.from("categories")
      .insert({ group_id: other.groupId, name: "남의카테고리", sort_order: 10 }).select("id").single();

    const r1 = await other.owner.client.rpc("set_transaction_category", { p_transaction: myTx, p_category: cafe });
    expect(r1.error?.message).toBe("not_allowed");
    const r2 = await mine.owner.client.rpc("set_transaction_category", { p_transaction: myTx, p_category: otherCat!.id });
    expect(r2.error?.message).toBe("not_allowed");
    const r3 = await anonClient().rpc("set_transaction_category", { p_transaction: myTx, p_category: cafe });
    expect(r3.error).not.toBeNull();
    expect(await tx(myTx)).toMatchObject({ category_id: null });
  });
});

describe("취소가 승인보다 먼저 도착", () => {
  it("승인이 오면 짝 없는 취소를 연결하고, 취소의 카테고리를 이어받는다", async () => {
    const cafe = await categoryId("카페");
    const g = await createGroupFixture("early-cancel");
    const cancel = await ingest(g, CANCEL, new Date("2026-09-23T08:40:00+09:00"));
    await g.owner.client.from("transactions").update({ category_id: cafe }).eq("id", cancel);

    const approval = await ingest(g, APPROVAL, new Date("2026-09-23T08:41:00+09:00"));
    expect(await tx(cancel)).toMatchObject({ cancels_transaction_id: approval });
    expect(await tx(approval)).toMatchObject({ category_id: cafe, category_source: "user" });
  });

  it("이미 짝이 있는 취소나 승인보다 이른 취소는 연결하지 않는다", async () => {
    const g = await createGroupFixture("early-cancel-no");
    const recv = new Date("2026-09-23T08:40:00+09:00");
    const first = await ingest(g, at(APPROVAL, "09/23 08:26"), recv);
    const cancel = await ingest(g, at(CANCEL, "09/23 08:30"), recv);
    expect(await tx(cancel)).toMatchObject({ cancels_transaction_id: first });

    const second = await ingest(g, at(APPROVAL, "09/23 08:28"), recv);
    expect(await tx(cancel)).toMatchObject({ cancels_transaction_id: first });
    expect(await tx(second)).toMatchObject({ cancels_transaction_id: null });

    const g2 = await createGroupFixture("early-cancel-before");
    const earlier = await ingest(g2, at(CANCEL, "09/23 08:20"), recv);
    await ingest(g2, at(APPROVAL, "09/23 08:26"), recv);
    expect(await tx(earlier)).toMatchObject({ cancels_transaction_id: null });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run tests/db/ledger.db.test.ts`
Expected: FAIL (`Could not find the function public.set_transaction_category`, 취소 연결 `null`)

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/20261002000100_ledger_screens.sql`:

```sql
-- 화면에서 카테고리를 고르면: 그 거래는 user, 가맹점 규칙 저장,
-- 같은 그룹·가맹점·같은 달(KST)의 미지정·ai 거래는 rule로 함께 바꾼다.
-- 미지정(null)으로 되돌리면 그 거래만 바꾸고 규칙은 그대로 둔다. 함께 바뀐 거래 수를 돌려준다.
create function public.set_transaction_category(p_transaction uuid, p_category uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_merchant text;
  v_at timestamptz;
  v_month_local timestamp;
  v_count int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select group_id, merchant, occurred_at into v_group, v_merchant, v_at
  from public.transactions where id = p_transaction
  for update;
  if v_group is null or v_group is distinct from public.my_group_id() then
    raise exception 'not_allowed';
  end if;
  if not public.is_my_category(p_category) then
    raise exception 'not_allowed';
  end if;

  update public.transactions
  set category_id = p_category,
      category_source = case when p_category is null then null else 'user' end
  where id = p_transaction;

  if p_category is null then
    return 0;
  end if;

  insert into public.merchant_rules (group_id, merchant_pattern, category_id)
  values (v_group, v_merchant, p_category)
  on conflict (group_id, merchant_pattern) do update set category_id = excluded.category_id;

  v_month_local := date_trunc('month', v_at at time zone 'Asia/Seoul');
  update public.transactions
  set category_id = p_category, category_source = 'rule'
  where group_id = v_group
    and merchant = v_merchant
    and id <> p_transaction
    and occurred_at >= (v_month_local at time zone 'Asia/Seoul')
    and occurred_at < ((v_month_local + interval '1 month') at time zone 'Asia/Seoul')
    and (category_source is null or category_source = 'ai');
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function public.set_transaction_category(uuid, uuid) from public, anon;
grant execute on function public.set_transaction_category(uuid, uuid) to authenticated;

-- ingest_sms: 승인을 저장할 때 먼저 도착한 짝 없는 취소(같은 그룹·사용자·가맹점, 금액 -승인액,
-- 승인 시각 이후 60일 안, 가장 이른 것)를 연결한다. 승인에 카테고리가 없으면 취소의 것을 이어받는다.
-- 나머지는 20261002000000_category_source.sql과 같다.
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
    update public.transactions set cancels_transaction_id = v_tx_id where id = v_early_cancel_id;
  end if;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;
```

- [ ] **Step 4: 마이그레이션 적용 후 테스트 통과 확인**

Run: `supabase migration up --local && pnpm vitest run tests/db/ledger.db.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 문서 수정**

`docs/superpowers/specs/2026-10-01-nof-payments-book-design.md` 4장 표의 `raw_messages` 비고를 바꾼다:

```
| `raw_messages` | `group_id`, `user_id`, `body`(마스킹), `body_hash`, `source`, `received_at`, `status`, `parser_id` | `status`: parsed / unparsed / ignored. `duplicate`는 저장하지 않고 ingest API 응답에만 쓴다 |
```

`docs/superpowers/specs/2026-10-02-screens-core-design.md` 3.1 예시의 `10월 2일 (목)`을 `10월 2일 (금)`으로 바꾼다.

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan`
Expected: 모두 통과. 기존 `ingest-service`·`category-source` 테스트도 통과해야 한다.

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add supabase/migrations/20261002000100_ledger_screens.sql tests/db/ledger.db.test.ts \
  docs/superpowers/specs/2026-10-01-nof-payments-book-design.md docs/superpowers/specs/2026-10-02-screens-core-design.md
git commit -m "feat: 카테고리 수정 시 규칙 학습·같은 달 일괄 적용과 먼저 온 취소 연결

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 날짜·합계·폼 검증 순수 함수

**Files:**
- Create: `src/ledger/month.ts`, `src/ledger/summary.ts`, `src/ledger/forms.ts`
- Test: `src/ledger/month.test.ts`, `src/ledger/summary.test.ts`, `src/ledger/forms.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // month.ts
  export type Month = { year: number; month: number };            // month: 1~12
  export function kstMonthOf(d: Date): Month;
  export function compareMonth(a: Month, b: Month): number;
  export function parseMonthParam(value: string | string[] | undefined, now: Date): Month;
  export function shiftMonth(m: Month, delta: number): Month;
  export function monthParam(m: Month): string;                   // "2026-10"
  export function monthLabel(m: Month): string;                   // "2026년 10월"
  export function monthRange(m: Month): { from: Date; to: Date };
  export function kstDayKey(d: Date): string;                      // "2026-10-01"
  export function dayLabel(key: string): string;                   // "10월 1일 (목)"
  export function kstLocalValue(d: Date): string;                  // "2026-10-02T08:26"
  export function parseKstLocal(value: string): Date | null;
  // summary.ts
  export type TxKind = "approval" | "cancel" | "manual";
  export type CategorySource = "rule" | "ai" | "user" | null;
  export type LedgerTx = { id: string; userId: string; kind: TxKind; amount: number; merchant: string;
    occurredAt: Date; categoryId: string | null; categorySource: CategorySource;
    cancelsTransactionId: string | null; memo: string; rawMessageId: string | null };
  export type Member = { userId: string; name: string };
  export type DayGroup = { key: string; label: string; items: LedgerTx[] };
  export function totals(txs: LedgerTx[], members: Member[]): { total: number; byMember: Array<Member & { amount: number }> };
  export function groupByDay(txs: LedgerTx[]): DayGroup[];
  export function formatWon(n: number): string;                    // "12,300", "-12,300"
  // forms.ts
  export type TxInput = { amount: number; merchant: string; occurredAt: Date; userId: string; categoryId: string | null; memo: string };
  export function parseTxForm(get: (name: string) => string): { ok: true; value: TxInput } | { ok: false; error: string };
  export function isUuid(value: unknown): value is string;
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ledger/month.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  compareMonth, dayLabel, kstDayKey, kstLocalValue, kstMonthOf, monthLabel, monthParam, monthRange,
  parseKstLocal, parseMonthParam, shiftMonth,
} from "./month";

const oct1Kst0030 = new Date("2026-09-30T15:30:00Z"); // KST 2026-10-01 00:30

describe("월 계산 (KST)", () => {
  it("UTC로 9월 30일이어도 KST 10월 1일이면 10월", () => {
    expect(kstMonthOf(oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(kstDayKey(oct1Kst0030)).toBe("2026-10-01");
  });

  it("month 쿼리: 형식이 맞으면 그 달, 틀리거나 미래면 이번 달", () => {
    expect(parseMonthParam("2026-09", oct1Kst0030)).toEqual({ year: 2026, month: 9 });
    expect(parseMonthParam(undefined, oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam(["2026-09"], oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam("2026-13", oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam("2026-9", oct1Kst0030)).toEqual({ year: 2026, month: 10 });
    expect(parseMonthParam("2026-11", oct1Kst0030)).toEqual({ year: 2026, month: 10 });
  });

  it("월 이동은 연도를 넘긴다", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(compareMonth({ year: 2026, month: 1 }, { year: 2025, month: 12 })).toBeGreaterThan(0);
  });

  it("월 범위는 KST 1일 0시부터 다음 달 1일 0시 전까지", () => {
    expect(monthRange({ year: 2026, month: 10 })).toEqual({
      from: new Date("2026-09-30T15:00:00Z"),
      to: new Date("2026-10-31T15:00:00Z"),
    });
    expect(monthRange({ year: 2026, month: 12 }).to).toEqual(new Date("2026-12-31T15:00:00Z"));
  });

  it("표기", () => {
    expect(monthParam({ year: 2026, month: 9 })).toBe("2026-09");
    expect(monthLabel({ year: 2026, month: 9 })).toBe("2026년 9월");
    expect(dayLabel("2026-10-01")).toBe("10월 1일 (목)");
    expect(dayLabel("2026-10-02")).toBe("10월 2일 (금)");
  });

  it("datetime-local 값은 KST로 해석하고, 없는 날짜는 null", () => {
    expect(parseKstLocal("2026-10-02T08:26")).toEqual(new Date("2026-10-01T23:26:00Z"));
    expect(kstLocalValue(new Date("2026-10-01T23:26:00Z"))).toBe("2026-10-02T08:26");
    expect(parseKstLocal("2026-02-30T10:00")).toBeNull();
    expect(parseKstLocal("2026-10-02 08:26")).toBeNull();
    expect(parseKstLocal("")).toBeNull();
  });
});
```

`src/ledger/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatWon, groupByDay, totals, type LedgerTx } from "./summary";

const base: LedgerTx = {
  id: "t", userId: "u1", kind: "approval", amount: 0, merchant: "가게", occurredAt: new Date(),
  categoryId: null, categorySource: null, cancelsTransactionId: null, memo: "", rawMessageId: null,
};
const t = (over: Partial<LedgerTx>): LedgerTx => ({ ...base, ...over });

describe("totals", () => {
  it("취소(음수)를 반영한 가족 합계와 구성원별 합계", () => {
    const txs = [
      t({ id: "a", userId: "u1", amount: 12300 }),
      t({ id: "b", userId: "u1", kind: "cancel", amount: -12300 }),
      t({ id: "c", userId: "u2", amount: 900 }),
      t({ id: "d", userId: "gone", amount: 5000 }),
    ];
    expect(totals(txs, [{ userId: "u1", name: "지민" }, { userId: "u2", name: "서연" }])).toEqual({
      total: 5900,
      byMember: [{ userId: "u1", name: "지민", amount: 0 }, { userId: "u2", name: "서연", amount: 900 }],
    });
  });
});

describe("groupByDay", () => {
  it("KST 날짜별로 묶고 최신순", () => {
    const groups = groupByDay([
      t({ id: "old", occurredAt: new Date("2026-09-30T15:30:00Z") }),  // KST 10/1 00:30
      t({ id: "new", occurredAt: new Date("2026-10-02T03:00:00Z") }),  // KST 10/2 12:00
      t({ id: "mid", occurredAt: new Date("2026-10-01T14:00:00Z") }),  // KST 10/1 23:00
    ]);
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["10월 2일 (금)", ["new"]],
      ["10월 1일 (목)", ["mid", "old"]],
    ]);
  });
});

describe("formatWon", () => {
  it("천 단위 쉼표, 음수", () => {
    expect(formatWon(1234000)).toBe("1,234,000");
    expect(formatWon(-12300)).toBe("-12,300");
    expect(formatWon(0)).toBe("0");
  });
});
```

`src/ledger/forms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isUuid, parseTxForm } from "./forms";

const form = (over: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    amount: "12,300", merchant: " 시장 ", occurredAt: "2026-10-02T08:26", userId: "u1", categoryId: "", memo: " 점심 ",
    ...over,
  };
  return (name: string) => values[name] ?? "";
};

describe("parseTxForm", () => {
  it("쉼표·원·공백을 정리해 받아들인다", () => {
    expect(parseTxForm(form())).toEqual({
      ok: true,
      value: {
        amount: 12300, merchant: "시장", occurredAt: new Date("2026-10-01T23:26:00Z"),
        userId: "u1", categoryId: null, memo: "점심",
      },
    });
    expect(parseTxForm(form({ amount: "12300원" }))).toMatchObject({ ok: true, value: { amount: 12300 } });
    expect(parseTxForm(form({ amount: " 5000 " }))).toMatchObject({ ok: true, value: { amount: 5000 } });
    expect(parseTxForm(form({ categoryId: "c1" }))).toMatchObject({ ok: true, value: { categoryId: "c1" } });
  });

  it("금액이 1원 이상 정수가 아니면 막는다", () => {
    for (const amount of ["0", "-5", "1.5", "abc", "", "99999999999999999"]) {
      expect(parseTxForm(form({ amount }))).toEqual({ ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." });
    }
  });

  it("가맹점 빈칸·일시 오류·사람 없음을 막는다", () => {
    expect(parseTxForm(form({ merchant: "  " }))).toEqual({ ok: false, error: "가맹점을 입력해 주세요." });
    expect(parseTxForm(form({ merchant: "가".repeat(101) }))).toEqual({ ok: false, error: "가맹점은 100자까지 입력할 수 있습니다." });
    expect(parseTxForm(form({ occurredAt: "2026-02-30T10:00" }))).toEqual({ ok: false, error: "일시를 확인해 주세요." });
    expect(parseTxForm(form({ userId: "" }))).toEqual({ ok: false, error: "사람을 골라 주세요." });
  });

  it("메모는 200자로 자른다", () => {
    const r = parseTxForm(form({ memo: "가".repeat(250) }));
    expect(r.ok && r.value.memo.length).toBe(200);
  });
});

describe("isUuid", () => {
  it("uuid 형식만 참", () => {
    expect(isUuid("5d30839b-4971-46f7-976c-0ab9d67c1067")).toBe(true);
    expect(isUuid("5d30839b")).toBe(false);
    expect(isUuid(["5d30839b-4971-46f7-976c-0ab9d67c1067"])).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run src/ledger`
Expected: FAIL (`Cannot find module './month'` 등)

- [ ] **Step 3: 구현**

`src/ledger/month.ts`:

```ts
/** 한국 시간(KST, UTC+9) 기준 월·날짜 계산. 한국은 서머타임이 없어 고정 오프셋을 쓴다. */
export type Month = { year: number; month: number };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const kst = (d: Date) => new Date(d.getTime() + KST_OFFSET_MS);

export function kstMonthOf(d: Date): Month {
  const k = kst(d);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1 };
}

export function compareMonth(a: Month, b: Month): number {
  return (a.year - b.year) * 12 + (a.month - b.month);
}

/** `?month=YYYY-MM`. 없거나 형식이 틀리거나 미래면 이번 달. */
export function parseMonthParam(value: string | string[] | undefined, now: Date): Month {
  const current = kstMonthOf(now);
  if (typeof value !== "string") return current;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return current;
  const parsed = { year: Number(m[1]), month: Number(m[2]) };
  if (parsed.month < 1 || parsed.month > 12 || compareMonth(parsed, current) > 0) return current;
  return parsed;
}

export function shiftMonth(m: Month, delta: number): Month {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export function monthParam(m: Month): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}`;
}

export function monthLabel(m: Month): string {
  return `${m.year}년 ${m.month}월`;
}

/** KST 그 달 1일 0시 ≤ t < 다음 달 1일 0시 */
export function monthRange(m: Month): { from: Date; to: Date } {
  const next = shiftMonth(m, 1);
  return {
    from: new Date(Date.UTC(m.year, m.month - 1, 1) - KST_OFFSET_MS),
    to: new Date(Date.UTC(next.year, next.month - 1, 1) - KST_OFFSET_MS),
  };
}

/** KST 날짜 키 "YYYY-MM-DD" */
export function kstDayKey(d: Date): string {
  return kst(d).toISOString().slice(0, 10);
}

/** "10월 1일 (목)" */
export function dayLabel(key: string): string {
  const [y, mo, da] = key.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, da)).getUTCDay()];
  return `${mo}월 ${da}일 (${weekday})`;
}

/** `<input type="datetime-local">` 값(KST) "YYYY-MM-DDTHH:mm" */
export function kstLocalValue(d: Date): string {
  return kst(d).toISOString().slice(0, 16);
}

export function parseKstLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi) - KST_OFFSET_MS);
  // 2월 30일처럼 넘어간 날짜는 되돌렸을 때 값이 달라진다
  return kstLocalValue(date) === value ? date : null;
}
```

`src/ledger/summary.ts`:

```ts
import { dayLabel, kstDayKey } from "./month";

export type TxKind = "approval" | "cancel" | "manual";
export type CategorySource = "rule" | "ai" | "user" | null;

export type LedgerTx = {
  id: string;
  userId: string;
  kind: TxKind;
  /** 취소는 음수 */
  amount: number;
  merchant: string;
  occurredAt: Date;
  categoryId: string | null;
  categorySource: CategorySource;
  cancelsTransactionId: string | null;
  memo: string;
  rawMessageId: string | null;
};

export type Member = { userId: string; name: string };
export type DayGroup = { key: string; label: string; items: LedgerTx[] };

/** 가족 합계(모든 거래)와 현재 구성원별 합계. 취소는 음수라 그대로 더한다. */
export function totals(txs: LedgerTx[], members: Member[]) {
  const byUser = new Map<string, number>();
  let total = 0;
  for (const tx of txs) {
    total += tx.amount;
    byUser.set(tx.userId, (byUser.get(tx.userId) ?? 0) + tx.amount);
  }
  return { total, byMember: members.map((m) => ({ ...m, amount: byUser.get(m.userId) ?? 0 })) };
}

/** KST 날짜별로 묶어 최신순 */
export function groupByDay(txs: LedgerTx[]): DayGroup[] {
  const sorted = [...txs].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const groups: DayGroup[] = [];
  for (const tx of sorted) {
    const key = kstDayKey(tx.occurredAt);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(key), items: [] };
      groups.push(group);
    }
    group.items.push(tx);
  }
  return groups;
}

const won = new Intl.NumberFormat("ko-KR");

export function formatWon(n: number): string {
  return won.format(n);
}
```

`src/ledger/forms.ts`:

```ts
import { parseKstLocal } from "./month";

export type TxInput = {
  amount: number;
  merchant: string;
  occurredAt: Date;
  userId: string;
  categoryId: string | null;
  memo: string;
};

export type TxFormResult = { ok: true; value: TxInput } | { ok: false; error: string };

/** 수동 입력·거래 수정 폼 검증. 금액은 쉼표·"원"·공백을 지우고 1원 이상 정수만 받는다. */
export function parseTxForm(get: (name: string) => string): TxFormResult {
  const amountText = get("amount").replace(/[,\s원]/g, "");
  const amount = Number(amountText);
  if (!/^\d+$/.test(amountText) || amount < 1 || !Number.isSafeInteger(amount)) {
    return { ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." };
  }
  const merchant = get("merchant").trim();
  if (!merchant) return { ok: false, error: "가맹점을 입력해 주세요." };
  if (merchant.length > 100) return { ok: false, error: "가맹점은 100자까지 입력할 수 있습니다." };
  const occurredAt = parseKstLocal(get("occurredAt"));
  if (!occurredAt) return { ok: false, error: "일시를 확인해 주세요." };
  const userId = get("userId");
  if (!userId) return { ok: false, error: "사람을 골라 주세요." };
  return {
    ok: true,
    value: {
      amount,
      merchant,
      occurredAt,
      userId,
      categoryId: get("categoryId") || null,
      memo: get("memo").trim().slice(0, 200),
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run src/ledger`
Expected: PASS (3 files)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add src/ledger
git commit -m "feat: 가계부 월·날짜(KST)·합계·폼 검증 함수 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Playwright 설치, 디자인 기본, PWA

**Files:**
- Create: `playwright.config.ts`, `e2e/support.ts`, `e2e/pwa.spec.ts`, `src/app/manifest.ts`, `src/app/icon.svg`, `src/app/apple-icon.tsx`
- Modify: `package.json`, `.gitignore`, `tests/helpers/db.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/auth/paths.ts`, `src/auth/paths.test.ts`

**Interfaces:**
- Produces: `pnpm test:e2e`; `e2e/support.ts`의 `signIn(context, email)`, `todayMmdd()`, `at(body, "MM/DD HH:mm")`; `tests/helpers/db.ts`의 `TestUser.email`, `PASSWORD`; Tailwind 색 `background`·`foreground`·`muted`·`line`·`surface`·`accent`·`danger`와 클래스 `tabular`.

- [ ] **Step 1: Playwright 설치 (승인됨)**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install webkit
```

`package.json` `scripts`에 추가:

```json
"test:e2e": "playwright test"
```

`.gitignore`의 "Next.js·테스트" 묶음에 추가:

```gitignore
playwright-report/
test-results/
```

- [ ] **Step 2: Playwright 설정과 도우미 작성**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

// 로컬 Supabase 주소·키(.env.local)를 테스트 도우미와 개발 서버가 함께 쓴다
process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { ...devices["iPhone 13"], baseURL: "http://127.0.0.1:3100" },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
    // 화면 테스트에서 실제 jev를 부르지 않는다
    env: { TYPESAFE_API_KEY: "" },
  },
});
```

`tests/helpers/db.ts`에서 `PASSWORD`를 내보내고 `TestUser`에 `email`을 넣는다:

```ts
export const PASSWORD = "test-password-1234";

export type TestUser = { userId: string; client: SupabaseClient; email: string };
```

`createLoneUser`의 마지막 줄을 `return { userId, client, email };`로 바꾼다(`const PASSWORD = …` 선언은 위 `export const`로 대체).

`e2e/support.ts`:

```ts
import type { BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { PASSWORD } from "../tests/helpers/db";

/**
 * 앱에는 이메일 로그인 화면이 없으므로, 로컬 Supabase의 비밀번호 로그인으로 세션을 만들어
 * 앱과 같은 형식(@supabase/ssr)의 쿠키를 브라우저에 넣는다.
 */
export async function signIn(context: BrowserContext, email: string): Promise<void> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          for (const { name, value } of cookies) {
            if (value) jar.set(name, value);
            else jar.delete(name);
          }
        },
      },
    },
  );
  const { error } = await supabase.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  await context.addCookies(
    [...jar].map(([name, value]) => ({ name, value, domain: "127.0.0.1", path: "/", sameSite: "Lax" as const })),
  );
}

/** 오늘(KST) "MM/DD" */
export function todayMmdd(now = new Date()): string {
  const k = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${String(k.getUTCMonth() + 1).padStart(2, "0")}/${String(k.getUTCDate()).padStart(2, "0")}`;
}

/** 같은 형식에서 일시만 바꾼 문자 */
export const at = (body: string, mmddHhmm: string) => body.replace(/\d{2}\/\d{2} \d{2}:\d{2}/, mmddHhmm);
```

- [ ] **Step 3: 실패하는 테스트 작성**

`src/auth/paths.test.ts`의 `describe("isPublicPath")` 안에 추가:

```ts
  it("PWA 매니페스트·아이콘은 로그인 없이 연다", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/apple-icon")).toBe(true);
  });
```

`e2e/pwa.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { createGroupFixture } from "../tests/helpers/db";
import { signIn } from "./support";

test("매니페스트와 아이콘은 로그인 없이 받는다", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect(await manifest.json()).toMatchObject({ short_name: "가계부", display: "standalone", start_url: "/" });

  const icon = await request.get("/apple-icon");
  expect(icon.status()).toBe(200);
  expect(icon.headers()["content-type"]).toContain("image/png");
});

test("홈에 PWA 메타와 시스템 글꼴이 적용된다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-pwa");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "가계부");
  await expect(page).toHaveTitle("가계부");
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font).toContain("-apple-system");
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `pnpm vitest run src/auth/paths.test.ts; pnpm test:e2e e2e/pwa.spec.ts`
Expected: FAIL (`isPublicPath("/manifest.webmanifest")`가 false, `/manifest.webmanifest`가 로그인으로 이동하거나 404, 제목이 `nof-payments-book`)

- [ ] **Step 5: 구현**

`src/auth/paths.ts`의 `isPublicPath`에 두 줄 추가:

```ts
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/auth/") ||
    // 홈 화면에 추가할 때 브라우저가 쿠키 없이 받을 수 있다
    pathname === "/manifest.webmanifest" ||
    pathname === "/apple-icon"
  );
}
```

`src/app/globals.css` 전체:

```css
@import "tailwindcss";

/* 아이폰 기본 앱 느낌: 흰 바탕, 회색 구분선, 강조색 하나. 다크 모드는 휴대폰 설정을 따른다. */
:root {
  --background: #ffffff;
  --foreground: #111111;
  --muted: #6b7280;
  --line: #e5e5ea;
  --surface: #f2f2f7;
  --accent: #007aff;
  --danger: #ff3b30;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #000000;
    --foreground: #f5f5f7;
    --muted: #8e8e93;
    --line: #2c2c2e;
    --surface: #1c1c1e;
    --accent: #0a84ff;
    --danger: #ff453a;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-surface: var(--surface);
  --color-accent: var(--accent);
  --color-danger: var(--danger);
  --font-sans: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  -webkit-tap-highlight-color: transparent;
}

.tabular {
  font-variant-numeric: tabular-nums;
}
```

`src/app/layout.tsx` 전체(Geist 글꼴 제거):

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "가계부",
  description: "부부·커플이 함께 쓰는 결제 문자 가계부",
  appleWebApp: { capable: true, title: "가계부", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
```

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "가계부",
    short_name: "가계부",
    description: "부부·커플이 함께 쓰는 결제 문자 가계부",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
```

`src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#007aff"/>
  <rect x="12" y="19" width="40" height="28" rx="5" fill="#ffffff"/>
  <rect x="12" y="25" width="40" height="6" fill="#007aff"/>
  <circle cx="44" cy="40" r="3" fill="#007aff"/>
</svg>
```

`src/app/apple-icon.tsx`(아이폰이 모서리를 둥글게 자르므로 사각형으로 그린다):

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#007aff" }}>
        <div style={{ width: 112, height: 78, borderRadius: 14, background: "#ffffff", display: "flex", flexDirection: "column" }}>
          <div style={{ marginTop: 16, height: 16, background: "#007aff" }} />
          <div style={{ marginTop: 16, marginLeft: 80, width: 16, height: 16, borderRadius: 8, background: "#007aff" }} />
        </div>
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm vitest run src/auth/paths.test.ts && pnpm test:e2e e2e/pwa.spec.ts`
Expected: PASS (paths 전체, e2e 2)

- [ ] **Step 7: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과. 기존 화면(그룹·기기·운영자)이 새 글꼴로 바뀌어도 동작은 같다.

- [ ] **Step 8: 커밋 (사용자 승인 후)**

```bash
git add package.json pnpm-lock.yaml .gitignore playwright.config.ts e2e tests/helpers/db.ts \
  src/app/globals.css src/app/layout.tsx src/app/manifest.ts src/app/icon.svg src/app/apple-icon.tsx \
  src/auth/paths.ts src/auth/paths.test.ts
git commit -m "feat: 아이폰 앱 느낌 디자인 기본·PWA와 Playwright 화면 테스트 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 홈 (합계 + 월별 거래)

**Files:**
- Create: `src/ledger/queries.ts`, `src/components/app-menu.tsx`, `src/components/no-group.tsx`, `src/components/ledger/month-summary.tsx`, `src/components/ledger/day-list.tsx`, `e2e/home.spec.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: Task 2의 `month.ts`·`summary.ts`; `src/categorize/categorize.ts`의 `categoryOptions`, `CategoryRow`
- Produces:
  ```ts
  // queries.ts (server-only)
  export type CategoryLite = { id: string; name: string };
  export type MonthData = {
    txs: LedgerTx[]; members: Member[];
    categoryNames: Map<string, string>;   // 거래 줄 표시용(모든 보이는 카테고리)
    categoryChoices: CategoryLite[];      // 카테고리 버튼용(이름 겹치면 그룹 것)
    cancelledIds: Set<string>; unparsedCount: number;
  };
  export async function loadMembers(db: SupabaseClient, groupId: string): Promise<Member[]>;
  export async function loadCategories(db: SupabaseClient): Promise<{ names: Map<string, string>; choices: CategoryLite[] }>;
  export async function loadMonth(db: SupabaseClient, groupId: string, month: Month): Promise<MonthData>;
  export async function loadTransaction(db: SupabaseClient, id: string): Promise<{ tx: LedgerTx; rawBody: string | null } | null>;
  export async function loadRawMessage(db: SupabaseClient, id: string): Promise<{ id: string; body: string; userId: string; receivedAt: Date } | null>;
  ```
  홈 주소: `/?month=YYYY-MM`, 거래 줄 링크: `/?month=YYYY-MM&tx=<id>`. 거래 줄에는 `data-testid="tx-row"`, 가족 합계에는 `data-testid="family-total"`.

- [ ] **Step 1: 실패하는 e2e 작성**

`e2e/home.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { APPROVAL, APPROVAL_SMALL, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture, createLoneUser, type GroupFixture } from "../tests/helpers/db";
import { at, signIn, todayMmdd } from "./support";

const db = adminClient();
const send = (g: GroupFixture, who: "owner" | "member", body: string) =>
  ingestMessage(db, { userId: g[who].userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

test("이번 달 합계·사람별 합계·날짜별 거래와 미분류 줄을 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-home");
  const day = todayMmdd();
  await send(g, "owner", at(APPROVAL, `${day} 00:01`));
  await send(g, "owner", at(APPROVAL, `${day} 00:02`));
  await send(g, "member", at(APPROVAL_SMALL, `${day} 00:03`));
  await send(g, "member", UNKNOWN_KB);

  await signIn(context, g.owner.email);
  await page.goto("/");

  await expect(page.getByTestId("family-total")).toHaveText("가족 25,500원");
  await expect(page.getByText("e2e-home-owner 24,600 · e2e-home-member 900")).toBeVisible();
  await expect(page.getByTestId("tx-row")).toHaveCount(3);
  await expect(page.getByTestId("tx-row").first()).toContainText("지에스(GS)25 테스트점");
  await expect(page.getByTestId("tx-row").first()).toContainText("미지정");
  await expect(page.getByRole("link", { name: /확인할 문자 1건/ })).toBeVisible();

  // 지난달로 가면 거래가 없고, 이번 달 이후로는 갈 수 없다
  await expect(page.getByRole("link", { name: "다음 달" })).toHaveCount(0);
  await page.getByRole("link", { name: "이전 달" }).click();
  await expect(page.getByText("이 달에는 거래가 없습니다")).toBeVisible();
  await expect(page.getByTestId("family-total")).toHaveText("가족 0원");
});

test("다른 그룹의 거래 id를 주소에 넣어도 시트가 열리지 않는다", async ({ page, context }) => {
  const mine = await createGroupFixture("e2e-home-mine");
  const other = await createGroupFixture("e2e-home-other");
  const r = await send(other, "owner", at(APPROVAL, `${todayMmdd()} 00:01`));

  await signIn(context, mine.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  await expect(page.getByTestId("family-total")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("그룹이 없는 사용자는 안내를 본다", async ({ page, context }) => {
  const lone = await createLoneUser("e2e-lone");
  await signIn(context, lone.email);
  await page.goto("/");
  await expect(page.getByText("아직 그룹이 없습니다")).toBeVisible();
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/home.spec.ts`
Expected: FAIL (`family-total` 없음)

- [ ] **Step 3: 데이터 읽기 구현**

`src/ledger/queries.ts`:

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryOptions, type CategoryRow } from "@/categorize/categorize";
import { monthRange, type Month } from "./month";
import type { CategorySource, LedgerTx, Member, TxKind } from "./summary";

export type CategoryLite = { id: string; name: string };
export type MonthData = {
  txs: LedgerTx[];
  members: Member[];
  categoryNames: Map<string, string>;
  categoryChoices: CategoryLite[];
  cancelledIds: Set<string>;
  unparsedCount: number;
};

const TX_COLUMNS =
  "id, user_id, kind, amount, merchant, occurred_at, category_id, category_source, cancels_transaction_id, memo, raw_message_id";

type TxRow = {
  id: string; user_id: string; kind: TxKind; amount: number; merchant: string; occurred_at: string;
  category_id: string | null; category_source: CategorySource; cancels_transaction_id: string | null;
  memo: string; raw_message_id: string | null;
};

function toLedgerTx(r: TxRow): LedgerTx {
  return {
    id: r.id, userId: r.user_id, kind: r.kind, amount: Number(r.amount), merchant: r.merchant,
    occurredAt: new Date(r.occurred_at), categoryId: r.category_id, categorySource: r.category_source,
    cancelsTransactionId: r.cancels_transaction_id, memo: r.memo, rawMessageId: r.raw_message_id,
  };
}

async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

/** 그룹 구성원(그룹장 먼저)과 표시 이름 */
export async function loadMembers(db: SupabaseClient, groupId: string): Promise<Member[]> {
  const rows = await must<{ user_id: string; role: string }[]>(
    db.from("group_members").select("user_id, role").eq("group_id", groupId),
  );
  const profiles = await must<{ user_id: string; display_name: string }[]>(
    db.from("profiles").select("user_id, display_name").in("user_id", rows.map((r) => r.user_id)),
  );
  const names = new Map(profiles.map((p) => [p.user_id, p.display_name]));
  return [...rows]
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
    .map((r) => ({ userId: r.user_id, name: names.get(r.user_id) ?? "알 수 없음" }));
}

/** 보이는 카테고리(기본 + 내 그룹, RLS). 버튼용은 이름이 겹치면 그룹 것만. */
export async function loadCategories(db: SupabaseClient) {
  const rows = await must<CategoryRow[]>(
    db.from("categories").select("id, name, group_id").order("sort_order").order("name"),
  );
  return {
    names: new Map(rows.map((r) => [r.id, r.name])),
    choices: categoryOptions(rows).map(({ id, name }) => ({ id, name })),
  };
}

export async function loadMonth(db: SupabaseClient, groupId: string, month: Month): Promise<MonthData> {
  const { from, to } = monthRange(month);
  const [rows, members, categories, unparsed] = await Promise.all([
    must<TxRow[]>(
      db.from("transactions").select(TX_COLUMNS)
        .gte("occurred_at", from.toISOString()).lt("occurred_at", to.toISOString())
        .order("occurred_at", { ascending: false }),
    ),
    loadMembers(db, groupId),
    loadCategories(db),
    db.from("raw_messages").select("id", { count: "exact", head: true }).eq("status", "unparsed"),
  ]);
  if (unparsed.error) throw unparsed.error;

  const txs = rows.map(toLedgerTx);
  // 취소가 연결된 결제(취소가 다른 달에 있어도)
  const approvalIds = txs.filter((t) => t.kind === "approval").map((t) => t.id);
  const cancelled = approvalIds.length
    ? await must<{ cancels_transaction_id: string }[]>(
        db.from("transactions").select("cancels_transaction_id").in("cancels_transaction_id", approvalIds),
      )
    : [];

  return {
    txs,
    members,
    categoryNames: categories.names,
    categoryChoices: categories.choices,
    cancelledIds: new Set(cancelled.map((c) => c.cancels_transaction_id)),
    unparsedCount: unparsed.count ?? 0,
  };
}

/** 거래 하나와 마스킹된 원문. 내 그룹 것이 아니면(RLS) null. */
export async function loadTransaction(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("transactions")
    .select(`${TX_COLUMNS}, raw_messages(body)`).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const raw = (data as unknown as { raw_messages: { body: string } | null }).raw_messages;
  return { tx: toLedgerTx(data as unknown as TxRow), rawBody: raw?.body ?? null };
}

/** 미분류 문자 하나. 내 그룹의 unparsed가 아니면 null. */
export async function loadRawMessage(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("raw_messages")
    .select("id, body, user_id, received_at").eq("id", id).eq("status", "unparsed").maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, body: data.body, userId: data.user_id, receivedAt: new Date(data.received_at) } : null;
}
```

- [ ] **Step 4: 화면 구현**

`src/components/no-group.tsx`(지금 홈의 그룹 없는 경우를 옮긴다):

```tsx
import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/session";

export function NoGroup({ me }: { me: Me }) {
  return (
    <main className="mx-auto w-full max-w-[480px] p-6">
      <h1 className="mb-1 text-xl font-bold">{me.displayName}님</h1>
      <p className="mb-6 text-muted">아직 그룹이 없습니다</p>
      <nav className="flex flex-col gap-2">
        {me.canCreateGroup && <Link className="text-accent" href="/group/new">그룹 만들기</Link>}
        {me.isOperator && <Link className="text-accent" href="/operator">운영자</Link>}
      </nav>
      <p className="mt-6 text-sm text-muted">가족에게 초대 링크를 받아 가입하면 같은 가계부를 함께 봅니다.</p>
      <form action={signOut} className="mt-8">
        <button className="text-sm text-muted">로그아웃</button>
      </form>
    </main>
  );
}
```

`src/components/app-menu.tsx`(JS 없이 열리는 메뉴):

```tsx
import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Me } from "@/lib/session";

export function AppMenu({ me }: { me: Me }) {
  const item = "rounded-lg px-3 py-2 active:bg-line";
  return (
    <details className="relative">
      <summary aria-label="메뉴" className="cursor-pointer list-none px-1 text-xl [&::-webkit-details-marker]:hidden">☰</summary>
      <nav className="absolute left-0 z-10 mt-2 flex w-48 flex-col rounded-xl bg-surface p-1 shadow-lg">
        <span className="px-3 py-2 text-sm text-muted">{me.displayName}님</span>
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

`src/components/ledger/month-summary.tsx`:

```tsx
import Link from "next/link";
import { compareMonth, kstMonthOf, monthLabel, monthParam, shiftMonth, type Month } from "@/ledger/month";
import { formatWon, type Member } from "@/ledger/summary";

export function MonthSummary({
  month, now, total, byMember,
}: { month: Month; now: Date; total: number; byMember: Array<Member & { amount: number }> }) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canNext = compareMonth(next, kstMonthOf(now)) <= 0;
  return (
    <section className="py-2 text-center">
      <div className="flex items-center justify-center gap-6">
        <Link href={`/?month=${monthParam(prev)}`} aria-label="이전 달" className="px-2 text-accent">◀</Link>
        <h1 className="text-base font-semibold">{monthLabel(month)}</h1>
        {canNext
          ? <Link href={`/?month=${monthParam(next)}`} aria-label="다음 달" className="px-2 text-accent">▶</Link>
          : <span aria-hidden className="px-2 text-line">▶</span>}
      </div>
      <p data-testid="family-total" className="tabular mt-3 text-3xl font-bold">가족 {formatWon(total)}원</p>
      <p className="tabular mt-1 text-sm text-muted">
        {byMember.map((m) => `${m.name} ${formatWon(m.amount)}`).join(" · ")}
      </p>
    </section>
  );
}
```

`src/components/ledger/day-list.tsx`:

```tsx
import Link from "next/link";
import { formatWon, type DayGroup } from "@/ledger/summary";

export function DayList({
  groups, base, categoryNames, memberNames, cancelledIds,
}: {
  groups: DayGroup[];
  base: string;
  categoryNames: Map<string, string>;
  memberNames: Map<string, string>;
  cancelledIds: Set<string>;
}) {
  if (groups.length === 0) {
    return <p className="py-12 text-center text-muted">이 달에는 거래가 없습니다</p>;
  }
  return (
    <div className="mt-2">
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="pt-4 pb-1 text-xs font-semibold text-muted">{g.label}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {g.items.map((t) => {
              const category = t.categoryId ? categoryNames.get(t.categoryId) : undefined;
              return (
                <li key={t.id}>
                  <Link data-testid="tx-row" href={`${base}&tx=${t.id}`} scroll={false} className="flex items-center gap-3 py-3 active:bg-surface">
                    <span className={`w-14 shrink-0 truncate text-sm ${category ? "" : "text-muted"}`}>{category ?? "미지정"}</span>
                    <span className="min-w-0 flex-1 truncate">{t.merchant}</span>
                    <span className="shrink-0 text-right">
                      <span className={`tabular block ${cancelledIds.has(t.id) ? "text-muted line-through" : ""}`}>
                        {formatWon(t.amount)}
                      </span>
                      <span className="block text-xs text-muted">
                        {memberNames.get(t.userId) ?? ""}{t.categorySource === "ai" ? " · 자동" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

`src/app/page.tsx` 전체(시트는 Task 5에서 붙인다):

```tsx
import Link from "next/link";
import { AppMenu } from "@/components/app-menu";
import { DayList } from "@/components/ledger/day-list";
import { MonthSummary } from "@/components/ledger/month-summary";
import { NoGroup } from "@/components/no-group";
import { monthParam, parseMonthParam } from "@/ledger/month";
import { loadMonth } from "@/ledger/queries";
import { groupByDay, totals } from "@/ledger/summary";
import { loadMe } from "@/lib/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { supabase, me } = await loadMe();
  if (!me.groupId) return <NoGroup me={me} />;

  const sp = await searchParams;
  const now = new Date();
  const month = parseMonthParam(sp.month, now);
  const data = await loadMonth(supabase, me.groupId, month);
  const sum = totals(data.txs, data.members);
  const base = `/?month=${monthParam(month)}`;

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-24">
      <header className="flex items-center justify-between py-3">
        <AppMenu me={me} />
        <Link href="/new" aria-label="직접 입력" className="px-2 text-2xl text-accent">+</Link>
      </header>
      <MonthSummary month={month} now={now} total={sum.total} byMember={sum.byMember} />
      {data.unparsedCount > 0 && (
        <Link href="/unparsed" className="mt-3 block rounded-xl bg-surface px-4 py-3 text-sm">
          확인할 문자 {data.unparsedCount}건 <span className="float-right text-muted">›</span>
        </Link>
      )}
      <DayList
        groups={groupByDay(data.txs)}
        base={base}
        categoryNames={data.categoryNames}
        memberNames={new Map(data.members.map((m) => [m.userId, m.name]))}
        cancelledIds={data.cancelledIds}
      />
    </main>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test:e2e e2e/home.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/ledger/queries.ts src/components src/app/page.tsx e2e/home.spec.ts
git commit -m "feat: 홈에 이번 달 합계와 날짜별 거래 목록 표시

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 거래 시트 (카테고리 학습, 수정, 삭제)

**Files:**
- Create: `src/app/tx-actions.ts`, `src/components/ledger/tx-sheet.tsx`, `src/components/ledger/category-picker.tsx`, `src/components/ledger/tx-edit-form.tsx`, `src/components/action-button.tsx`, `e2e/category.spec.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: Task 1의 RPC `set_transaction_category`; Task 2의 `parseTxForm`, `isUuid`, `kstLocalValue`, `kstMonthOf`, `monthParam`; Task 4의 `loadTransaction`, `MonthData`
- Produces:
  ```ts
  // tx-actions.ts ("use server")
  export type ActionState = { error?: string; values?: Record<string, string> } | null; // values: 검증 실패 시 입력값
  export async function setCategoryAction(prev: ActionState, formData: FormData): Promise<ActionState>; // txId, categoryId(""=미지정), returnTo
  export async function updateTxAction(prev: ActionState, formData: FormData): Promise<ActionState>;   // txId, returnTo, amount, merchant, occurredAt, userId, memo
  export async function deleteTxAction(txId: string, returnTo: string): Promise<ActionState>;          // bind(null, txId, returnTo)로 ActionButton에
  export async function createTxAction(prev: ActionState, formData: FormData): Promise<ActionState>;   // Task 6에서 추가
  // action-button.tsx ("use client")
  export function ActionButton(props: { action: (prev: ActionState, formData: FormData) => Promise<ActionState>; label: string; confirmText?: string; className?: string }): JSX.Element;
  ```

- [ ] **Step 1: 실패하는 e2e 작성 (스펙의 핵심 흐름)**

`e2e/category.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { APPROVAL, APPROVAL_SMALL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture, type GroupFixture } from "../tests/helpers/db";
import { at, signIn, todayMmdd } from "./support";

const db = adminClient();
const send = (g: GroupFixture, body: string) =>
  ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

test("거래를 탭해 카테고리를 고르면 같은 가맹점 거래도 바뀌고 규칙이 저장된다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-cat");
  const day = todayMmdd();
  await send(g, at(APPROVAL, `${day} 00:01`));
  await send(g, at(APPROVAL, `${day} 00:02`));
  await send(g, at(APPROVAL_SMALL, `${day} 00:03`));

  await signIn(context, g.owner.email);
  await page.goto("/");
  const coffee = page.getByTestId("tx-row").filter({ hasText: "테스트커피" });
  await expect(coffee).toHaveCount(2);

  await coffee.first().click();
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "카페", exact: true }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(coffee.filter({ hasText: "카페" })).toHaveCount(2);
  await expect(page.getByTestId("tx-row").filter({ hasText: "지에스(GS)25" })).toContainText("미지정");

  const { data: rule } = await db.from("merchant_rules").select("category_id, categories(name)")
    .eq("group_id", g.groupId).single();
  expect((rule as unknown as { categories: { name: string } }).categories.name).toBe("카페");
});

test("더 보기에서 메모·금액을 고치고, 잘못된 금액은 이유를 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-edit");
  const r = await send(g, at(APPROVAL, `${todayMmdd()} 00:01`));

  await signIn(context, g.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await sheet.getByText("더 보기").click();
  await sheet.getByLabel("금액").fill("0");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("금액은 1원 이상 숫자로 입력해 주세요.");

  await sheet.getByLabel("금액").fill("15,000");
  await sheet.getByLabel("메모").fill("회의 간식");
  await sheet.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("family-total")).toHaveText("가족 15,000원");

  const { data } = await db.from("transactions").select("amount, memo").eq("id", r.transactionId!).single();
  expect(data).toEqual({ amount: 15000, memo: "회의 간식" });
});

test("문자에서 온 거래는 삭제 버튼이 없고 원문을 볼 수 있다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-raw");
  const r = await send(g, at(APPROVAL, `${todayMmdd()} 00:01`));
  await signIn(context, g.owner.email);
  await page.goto(`/?tx=${r.transactionId}`);
  const sheet = page.getByRole("dialog", { name: "거래 수정" });
  await sheet.getByText("더 보기").click();
  await expect(sheet.getByRole("button", { name: "삭제" })).toHaveCount(0);
  await sheet.getByText("원문 보기").click();
  await expect(sheet.getByText("KB국민카드")).toBeVisible();
  await expect(sheet.getByText("1234승인")).toHaveCount(0); // 카드번호는 마스킹돼 있다
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/category.spec.ts`
Expected: FAIL (dialog "거래 수정" 없음)

- [ ] **Step 3: 서버 액션 구현**

`src/app/tx-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/auth/paths";
import { parseTxForm } from "@/ledger/forms";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * values: React 19는 액션이 끝나면 폼을 초기화하므로, 실패하면 입력값을 돌려줘 폼이 다시 채우게 한다.
 */
export type ActionState = { error?: string; values?: Record<string, string> } | null;

const FAIL = "저장하지 못했습니다. 다시 시도해 주세요.";
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");
/** React 내부 필드($ACTION_…)를 뺀 입력값 */
const valuesOf = (formData: FormData) =>
  Object.fromEntries([...formData.entries()].filter(([k, v]) => !k.startsWith("$") && typeof v === "string")) as Record<string, string>;

/** 카테고리 버튼: 규칙 학습·같은 달 일괄 적용은 DB 함수가 한다. */
export async function setCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_transaction_category", {
    p_transaction: text(formData, "txId"),
    p_category: text(formData, "categoryId") || null,
  });
  if (error) return { error: FAIL };
  revalidatePath("/");
  redirect(safeNextPath(text(formData, "returnTo")));
}

/** 더 보기: 금액·가맹점·일시·사람·메모. 취소 거래는 음수를 유지한다. */
export async function updateTxAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseTxForm((name) => text(formData, name));
  if (!parsed.ok) return { error: parsed.error, values: valuesOf(formData) };
  const supabase = await createSupabaseServerClient();
  const txId = text(formData, "txId");
  const { data: current } = await supabase.from("transactions").select("kind").eq("id", txId).maybeSingle();
  if (!current) return { error: FAIL, values: valuesOf(formData) };
  const v = parsed.value;
  const { error } = await supabase.from("transactions").update({
    amount: current.kind === "cancel" ? -v.amount : v.amount,
    merchant: v.merchant,
    occurred_at: v.occurredAt.toISOString(),
    user_id: v.userId,
    memo: v.memo,
  }).eq("id", txId);
  if (error) return { error: FAIL, values: valuesOf(formData) };
  revalidatePath("/");
  redirect(safeNextPath(text(formData, "returnTo")));
}

/** 수동 입력 거래만 삭제한다. */
export async function deleteTxAction(txId: string, returnTo: string): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("transactions").delete().eq("id", txId).eq("kind", "manual");
  if (error) return { error: FAIL };
  revalidatePath("/");
  redirect(safeNextPath(returnTo));
}
```

`deleteTxAction`은 `bind(null, txId, returnTo)`로 묶어 `ActionButton`에 넘긴다. 묶인 함수는 `(prev, formData)`를 더 받지만 쓰지 않는다.

- [ ] **Step 4: 시트 컴포넌트 구현**

`src/components/action-button.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/tx-actions";

/** 버튼 하나짜리 서버 액션 폼. 실패하면 이유를 버튼 아래에 보여 준다. */
export function ActionButton({
  action, label, confirmText, className = "",
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  confirmText?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <button disabled={pending} className={`disabled:opacity-50 ${className}`}>{label}</button>
      {state?.error && <p role="alert" className="mt-1 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
```

`src/components/ledger/category-picker.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { setCategoryAction } from "@/app/tx-actions";

export function CategoryPicker({
  txId, current, choices, returnTo,
}: { txId: string; current: string | null; choices: { id: string; name: string }[]; returnTo: string }) {
  const [state, formAction, pending] = useActionState(setCategoryAction, null);
  const button = (selected: boolean) =>
    `rounded-xl px-2 py-3 text-sm disabled:opacity-50 ${selected ? "bg-accent text-white" : "bg-surface"}`;
  return (
    <form action={formAction}>
      <input type="hidden" name="txId" value={txId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="grid grid-cols-3 gap-2">
        {choices.map((c) => (
          <button key={c.id} name="categoryId" value={c.id} disabled={pending} aria-pressed={c.id === current} className={button(c.id === current)}>
            {c.name}
          </button>
        ))}
        <button name="categoryId" value="" disabled={pending} aria-pressed={current === null} className={button(current === null)}>
          미지정
        </button>
      </div>
      {state?.error && <p role="alert" className="mt-2 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
```

`src/components/ledger/tx-edit-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { updateTxAction } from "@/app/tx-actions";

export function TxEditForm({
  txId, returnTo, amount, merchant, occurredAt, userId, memo, members,
}: {
  txId: string; returnTo: string; amount: number; merchant: string; occurredAt: string;
  userId: string; memo: string; members: { userId: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateTxAction, null);
  const field = "w-full rounded-lg bg-surface px-3 py-2";
  const v = state?.values;
  return (
    <form action={formAction} className="mt-3 flex flex-col gap-3 text-sm">
      <input type="hidden" name="txId" value={txId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>금액<input name="amount" inputMode="numeric" defaultValue={v?.amount ?? Math.abs(amount)} className={field} /></label>
      <label>가맹점<input name="merchant" defaultValue={v?.merchant ?? merchant} className={field} /></label>
      <label>일시<input name="occurredAt" type="datetime-local" defaultValue={v?.occurredAt ?? occurredAt} className={field} /></label>
      <label>사람
        <select name="userId" defaultValue={v?.userId ?? userId} className={field}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </label>
      <label>메모<input name="memo" defaultValue={v?.memo ?? memo} className={field} /></label>
      {state?.error && <p role="alert" className="text-danger">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-accent py-3 text-white disabled:opacity-50">저장</button>
    </form>
  );
}
```

`src/components/ledger/tx-sheet.tsx`:

```tsx
import Link from "next/link";
import { deleteTxAction } from "@/app/tx-actions";
import { ActionButton } from "@/components/action-button";
import { kstLocalValue } from "@/ledger/month";
import { formatWon, type LedgerTx, type Member } from "@/ledger/summary";
import { CategoryPicker } from "./category-picker";
import { TxEditForm } from "./tx-edit-form";

export function TxSheet({
  tx, rawBody, choices, members, closeHref,
}: { tx: LedgerTx; rawBody: string | null; choices: { id: string; name: string }[]; members: Member[]; closeHref: string }) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      <Link href={closeHref} scroll={false} aria-label="닫기" className="absolute inset-0 bg-black/30" />
      <section role="dialog" aria-label="거래 수정" className="relative mx-auto max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-background p-4 pb-10">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="truncate font-semibold">{tx.merchant}</h2>
          <span className="tabular shrink-0">{formatWon(tx.amount)}원</span>
        </div>
        <CategoryPicker txId={tx.id} current={tx.categoryId} choices={choices} returnTo={closeHref} />
        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-accent">더 보기</summary>
          <TxEditForm
            txId={tx.id} returnTo={closeHref} amount={tx.amount} merchant={tx.merchant}
            occurredAt={kstLocalValue(tx.occurredAt)} userId={tx.userId} memo={tx.memo} members={members}
          />
          {tx.kind === "manual" && (
            <div className="mt-4">
              <ActionButton
                action={deleteTxAction.bind(null, tx.id, closeHref)}
                label="삭제" confirmText="이 거래를 삭제할까요?" className="w-full py-3 text-danger"
              />
            </div>
          )}
          {rawBody && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted">원문 보기</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface p-3 font-sans">{rawBody}</pre>
            </details>
          )}
        </details>
      </section>
    </div>
  );
}
```

`src/app/page.tsx`에 시트를 붙인다. import 추가:

```tsx
import { TxSheet } from "@/components/ledger/tx-sheet";
import { isUuid } from "@/ledger/forms";
import { loadMonth, loadTransaction } from "@/ledger/queries";
```

(`import { loadMonth } from "@/ledger/queries";` 줄은 위 줄로 바꾼다.) `const base = …` 다음에:

```tsx
  const selected = isUuid(sp.tx) ? await loadTransaction(supabase, sp.tx) : null;
```

`</main>` 바로 앞에:

```tsx
      {selected && (
        <TxSheet tx={selected.tx} rawBody={selected.rawBody} choices={data.categoryChoices} members={data.members} closeHref={base} />
      )}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test:e2e e2e/category.spec.ts e2e/home.spec.ts`
Expected: PASS (category 3, home 3)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/app/tx-actions.ts src/app/page.tsx src/components e2e/category.spec.ts
git commit -m "feat: 거래 시트에서 카테고리 학습·수정·삭제

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 수동 입력과 미분류 문자

**Files:**
- Create: `src/app/new/page.tsx`, `src/components/ledger/tx-form.tsx`, `src/app/unparsed/page.tsx`, `src/app/unparsed/actions.ts`, `e2e/manual-unparsed.spec.ts`
- Modify: `src/app/tx-actions.ts` (`createTxAction` 추가)

**Interfaces:**
- Consumes: Task 2의 `parseTxForm`, `isUuid`, `kstLocalValue`, `kstMonthOf`, `monthParam`; Task 4의 `loadMembers`, `loadCategories`, `loadRawMessage`; Task 5의 `ActionState`, `ActionButton`
- Produces: `/new`, `/new?raw=<id>`, `/unparsed`; `createTxAction(prev, formData)`(필드: amount, merchant, occurredAt, userId, categoryId, memo, rawId); `ignoreRawAction(rawId)`(bind로 `ActionButton`에 넘김)

- [ ] **Step 1: 실패하는 e2e 작성**

`e2e/manual-unparsed.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture, type GroupFixture } from "../tests/helpers/db";
import { signIn } from "./support";

const db = adminClient();
const send = (g: GroupFixture, body: string) =>
  ingestMessage(db, { userId: g.member.userId, groupId: g.groupId }, { body, receivedAt: new Date(), source: "manual_test" });

test("+로 직접 입력하면 홈에 나타나고, 잘못된 입력은 이유를 보여 준다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-new");
  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("link", { name: "직접 입력" }).click();

  await page.getByLabel("금액").fill("abc");
  await page.getByLabel("가맹점").fill("동네 시장");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("alert")).toHaveText("금액은 1원 이상 숫자로 입력해 주세요.");

  await page.getByLabel("금액").fill("8,000");
  await page.getByLabel("카테고리").selectOption({ label: "식비" });
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByTestId("family-total")).toHaveText("가족 8,000원");
  const row = page.getByTestId("tx-row").filter({ hasText: "동네 시장" });
  await expect(row).toContainText("식비");
  await expect(row).toContainText("e2e-new-owner");

  // 수동 입력 거래는 시트에서 삭제할 수 있다
  page.on("dialog", (d) => d.accept());
  await row.click();
  await page.getByRole("dialog", { name: "거래 수정" }).getByText("더 보기").click();
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByTestId("tx-row")).toHaveCount(0);
});

test("미분류 문자를 거래로 등록하면 목록과 홈의 확인 줄에서 사라진다", async ({ page, context }) => {
  const g = await createGroupFixture("e2e-unparsed");
  await send(g, UNKNOWN_KB);
  await send(g, `${UNKNOWN_KB}\n두 번째`);

  await signIn(context, g.owner.email);
  await page.goto("/");
  await page.getByRole("link", { name: /확인할 문자 2건/ }).click();
  await expect(page.getByTestId("raw-item")).toHaveCount(2);

  await page.getByTestId("raw-item").filter({ hasText: "두 번째" }).getByRole("button", { name: "무시" }).click();
  await expect(page.getByTestId("raw-item")).toHaveCount(1);

  await page.getByRole("link", { name: "거래로 등록" }).click();
  await expect(page.getByText("결제금액 안내")).toBeVisible();
  await expect(page.getByLabel("사람")).toHaveValue(g.member.userId);
  await page.getByLabel("금액").fill("1,234,567");
  await page.getByLabel("가맹점").fill("국민카드 결제");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByTestId("tx-row").filter({ hasText: "국민카드 결제" })).toBeVisible();
  await expect(page.getByRole("link", { name: /확인할 문자/ })).toHaveCount(0);
  await page.goto("/unparsed");
  await expect(page.getByText("확인할 문자가 없습니다")).toBeVisible();
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:e2e e2e/manual-unparsed.spec.ts`
Expected: FAIL (`/new` 404)

- [ ] **Step 3: 서버 액션 구현**

`src/app/tx-actions.ts` 상단 import에 추가:

```ts
import { isUuid } from "@/ledger/forms";
import { kstMonthOf, monthParam } from "@/ledger/month";
import { loadMe } from "@/lib/session";
```

(기존 `import { parseTxForm } from "@/ledger/forms";`는 `import { isUuid, parseTxForm } from "@/ledger/forms";`로 합친다.) 파일 끝에 추가:

```ts
/** 수동 입력. 미분류 문자에서 왔으면(rawId) 저장 뒤 문자 상태를 parsed로 바꾼다. */
export async function createTxAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseTxForm((name) => text(formData, name));
  if (!parsed.ok) return { error: parsed.error, values: valuesOf(formData) };
  const { supabase, me } = await loadMe();
  if (!me.groupId) return { error: FAIL, values: valuesOf(formData) };
  const v = parsed.value;
  const { error } = await supabase.from("transactions").insert({
    group_id: me.groupId,
    user_id: v.userId,
    kind: "manual",
    amount: v.amount,
    merchant: v.merchant,
    occurred_at: v.occurredAt.toISOString(),
    category_id: v.categoryId,
    memo: v.memo,
  });
  if (error) return { error: FAIL, values: valuesOf(formData) };

  const rawId = text(formData, "rawId");
  if (isUuid(rawId)) {
    // 실패해도 거래는 이미 저장됐다. 문자가 목록에 남으면 사용자가 무시할 수 있다.
    const { error: rawError } = await supabase.from("raw_messages").update({ status: "parsed" }).eq("id", rawId);
    if (rawError) console.warn(`[unparsed] 문자 ${rawId} 상태 변경 실패: ${rawError.message}`);
  }
  revalidatePath("/");
  revalidatePath("/unparsed");
  redirect(`/?month=${monthParam(kstMonthOf(v.occurredAt))}`);
}
```

`src/app/unparsed/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/tx-actions";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function ignoreRawAction(rawId: string): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("raw_messages").update({ status: "ignored" }).eq("id", rawId);
  if (error) return { error: "저장하지 못했습니다. 다시 시도해 주세요." };
  revalidatePath("/unparsed");
  revalidatePath("/");
  return null;
}
```

- [ ] **Step 4: 화면 구현**

`src/components/ledger/tx-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { createTxAction } from "@/app/tx-actions";

export function TxForm({
  members, choices, defaultUserId, defaultOccurredAt, rawId,
}: {
  members: { userId: string; name: string }[];
  choices: { id: string; name: string }[];
  defaultUserId: string;
  defaultOccurredAt: string;
  rawId: string | null;
}) {
  const [state, formAction, pending] = useActionState(createTxAction, null);
  const field = "w-full rounded-lg bg-surface px-3 py-2";
  const v = state?.values;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {rawId && <input type="hidden" name="rawId" value={rawId} />}
      <label>금액<input name="amount" inputMode="numeric" autoFocus defaultValue={v?.amount ?? ""} className={field} /></label>
      <label>가맹점<input name="merchant" defaultValue={v?.merchant ?? ""} className={field} /></label>
      <label>일시<input name="occurredAt" type="datetime-local" defaultValue={v?.occurredAt ?? defaultOccurredAt} className={field} /></label>
      <label>사람
        <select name="userId" defaultValue={v?.userId ?? defaultUserId} className={field}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </label>
      <label>카테고리
        <select name="categoryId" defaultValue={v?.categoryId ?? ""} className={field}>
          <option value="">미지정</option>
          {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>메모<input name="memo" defaultValue={v?.memo ?? ""} className={field} /></label>
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-accent py-3 text-white disabled:opacity-50">저장</button>
    </form>
  );
}
```

`src/app/new/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { TxForm } from "@/components/ledger/tx-form";
import { isUuid } from "@/ledger/forms";
import { kstLocalValue } from "@/ledger/month";
import { loadCategories, loadMembers, loadRawMessage } from "@/ledger/queries";
import { loadMe } from "@/lib/session";

export default async function NewTxPage({ searchParams }: PageProps<"/new">) {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const sp = await searchParams;
  const [members, categories, raw] = await Promise.all([
    loadMembers(supabase, me.groupId),
    loadCategories(supabase),
    isUuid(sp.raw) ? loadRawMessage(supabase, sp.raw) : null,
  ]);

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">취소</Link>
        <h1 className="font-semibold">직접 입력</h1>
        <span className="w-8" />
      </header>
      {raw && (
        <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-surface p-3 font-sans text-sm">{raw.body}</pre>
      )}
      <TxForm
        members={members}
        choices={categories.choices}
        defaultUserId={raw?.userId ?? me.userId}
        defaultOccurredAt={kstLocalValue(raw?.receivedAt ?? new Date())}
        rawId={raw?.id ?? null}
      />
    </main>
  );
}
```

`src/app/unparsed/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { loadMembers } from "@/ledger/queries";
import { loadMe } from "@/lib/session";
import { ignoreRawAction } from "./actions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function UnparsedPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const [{ data, error }, members] = await Promise.all([
    supabase.from("raw_messages").select("id, body, user_id, received_at")
      .eq("status", "unparsed").order("received_at", { ascending: false }),
    loadMembers(supabase, me.groupId),
  ]);
  if (error) throw error;
  const names = new Map(members.map((m) => [m.userId, m.name]));

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">‹ 홈</Link>
        <h1 className="font-semibold">확인할 문자</h1>
        <span className="w-8" />
      </header>
      {data.length === 0 ? (
        <p className="py-12 text-center text-muted">확인할 문자가 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((r) => (
            <li key={r.id} data-testid="raw-item" className="rounded-xl bg-surface p-3">
              <p className="mb-2 text-xs text-muted">{names.get(r.user_id) ?? ""} · {when(r.received_at)}</p>
              <pre className="whitespace-pre-wrap font-sans text-sm">{r.body}</pre>
              <div className="mt-3 flex items-center justify-end gap-4 text-sm">
                <ActionButton action={ignoreRawAction.bind(null, r.id)} label="무시" className="text-muted" />
                <Link href={`/new?raw=${r.id}`} className="text-accent">거래로 등록</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test:e2e e2e/manual-unparsed.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 아이폰 실기기 확인 (사용자)**

로컬 서버를 같은 Wi-Fi에서 열 수 있으면(`pnpm dev --hostname 0.0.0.0`), 사용자가 아이폰 Safari로 홈 → 거래 탭 → 카테고리 변경 → 공유 › 홈 화면에 추가를 해 본다. 로그인은 Google 로그인이므로 로컬 Supabase의 Google 설정(계획 2)이 맞는지 먼저 확인한다. 불가능하면 배포(계획 4) 후 확인한다.

- [ ] **Step 8: 커밋 (사용자 승인 후)**

```bash
git add src/app/tx-actions.ts src/app/new src/app/unparsed src/components/ledger/tx-form.tsx e2e/manual-unparsed.spec.ts
git commit -m "feat: 수동 입력과 미분류 문자 등록·무시 화면

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 범위 밖 (3-2 이후)

- 통계, 카테고리 상위, 사람·카테고리 필터, 카테고리·가맹점 규칙 관리, 예산, 기기별 설정 안내
- 오프라인 캐시(서비스 워커)
- 미분류 문자 등록을 DB 함수 하나로 묶기(지금은 두 번 저장, 받아들인 위험)
