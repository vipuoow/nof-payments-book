# jev 가맹점 카테고리 자동 분류 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가맹점 규칙이 없는 결제 거래를 TypeSafe의 jev 모델로 분류해 카테고리를 채우고, 확신이 낮으면 "미지정"으로 둔다.

**Architecture:** 문자 저장 흐름(`ingest_sms`)은 바꾸지 않고, ingest 응답을 보낸 뒤 Next.js `after()`로 분류를 실행한다. 분류는 프레임워크와 무관한 `src/categorize` 모듈에 둔다. `typesafe.ts`는 TypeSafe HTTP 호출만, `categorize.ts`는 거래·카테고리 조회와 판단·저장을 맡는다. 거래에 `category_source`(rule/ai/user)를 추가해 누가 카테고리를 정했는지 남긴다.

**Tech Stack:** Next.js 16(App Router, `after`), TypeScript, Zod, @supabase/supabase-js v2, Vitest, 로컬 Supabase, TypeSafe System One API(`jev-latest`, Choice 질문)

**Spec:** `docs/superpowers/specs/2026-10-01-nof-payments-book-design.md` (5장 6번, 4장 `transactions`, 7장 외부 전송)

## Global Constraints

- 작업 원칙: **각 Task 시작 전과 모든 커밋 전에 사용자 승인**을 받는다.
- 공개 저장소: 비밀값은 `.env*`에만 둔다. `.env.example`에는 키 이름만 적는다. 커밋 전 `.githooks/pre-commit`(gitleaks + 로컬 실제 키 값 대조)이 통과해야 한다.
- TypeSafe에는 **가맹점 이름과 카테고리 이름·설명만** 보낸다. 금액·사람·날짜·문자 원문은 보내지 않는다.
- TypeSafe API 키 환경변수 이름은 `TYPESAFE_API_KEY`다. 키가 없으면 분류를 건너뛴다. 키 값·가맹점 이름은 로그에 남기지 않는다.
- 설정값은 하드코딩하지 않고 `app_settings`에 둔다: `category_ai_min_confidence`=0.7.
- 자동 테스트는 TypeSafe를 실제로 호출하지 않는다(가짜 `fetch`·가짜 분류기 사용).
- jev 결과는 `merchant_rules`에 저장하지 않는다. 규칙은 사용자가 고친 결과로만 배운다.
- 검증: 매 Task 끝에 `pnpm test`, `pnpm test:db`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm secrets:scan`을 모두 실행한다. DB 테스트는 로컬 Supabase가 켜져 있어야 한다(`supabase start`).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.

## Review Focus

1. **TypeSafe가 느리거나 멈춘 경우**: ingest 응답은 기다리지 않고 바로 나가야 하고, 분류는 5초 뒤 포기해 거래는 "미지정"으로 남아야 한다. → Task 2(시간 초과) · Task 4(분류 작업이 실패해도 예외가 밖으로 새지 않음) 테스트
2. **jev가 답하는 사이 사용자가 카테고리를 먼저 고친 경우**: jev 결과가 사용자 선택을 덮어쓰면 안 된다. → Task 3 테스트
3. **그룹이 기본 카테고리와 같은 이름(예: "카페")을 만든 경우**: 선택지 이름이 겹치지 않아야 하고, 그룹 것이 선택돼야 한다. 다른 그룹의 카테고리는 선택지에 들어가면 안 된다. → Task 3 테스트
4. **자동 분류된 결제가 나중에 취소된 경우**: 취소 거래는 원래 결제의 카테고리와 출처(`ai`)를 이어받아 카테고리별 합계에서 서로 상쇄돼야 한다. → Task 1 테스트
5. **같은 문자가 두 번 온 경우**: 두 번째(`duplicate`)에는 분류를 다시 요청하지 않아야 한다(비용). → Task 4 테스트

## 스펙과 다르게 구체화한 부분

- 분류 대상은 카테고리가 비어 있는 `approval`·`cancel` 거래다. 취소는 먼저 원래 결제의 카테고리를 이어받고(DB 함수), 이어받을 것이 없을 때만 jev에 묻는다. `manual` 거래는 묻지 않는다.
- jev가 "기타"를 고르면 "미지정"으로 둔다. 결제대행사·간편결제처럼 판단할 수 없는 가맹점이 대부분 여기에 해당한다(2026-10-02 사전 시험).
- 사용자가 화면에서 카테고리를 넣거나 바꾸면 트리거가 `category_source`를 `user`로 바꾼다. 사용자는 `category_source`를 직접 쓸 수 없다(컬럼 권한 없음).

## 사전 시험 결과 (2026-10-02, 가상 가맹점 19개, 1회 호출)

- 답이 분명한 15개는 모두 맞음(확신 0.94~1.00). 잘린 이름 `테스트커피 강남역점(메가`도 카페 1.00.
- 애매한 4개: 이마트 → 생활 0.97, 다이소 → 생활 0.78, 결제대행사 → 기타 0.29, 간편결제 → 기타 0.45.
- 가맹점당 약 400토큰, 19개 한 번에 0.5초. 이 결과로 기준값 0.7과 "기타는 미지정" 규칙을 정했다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20261002000000_category_source.sql` | `category_source` 칸, 설정값, 사용자 수정 트리거, `ingest_sms` 갱신 |
| `src/categorize/typesafe.ts` | TypeSafe Choice 요청·응답 처리, 실패 시 `null` |
| `src/categorize/typesafe.test.ts` | 가짜 `fetch`로 요청 내용·실패 처리 단위 테스트 |
| `src/categorize/categorize.ts` | 선택지 만들기, 결과 판단, 거래 분류·저장 |
| `src/categorize/categorize.test.ts` | 선택지·판단 단위 테스트 |
| `src/ingest/handler.ts` | 응답 후 분류 작업 예약 |
| `src/app/api/ingest/route.ts` | 키로 분류기 생성, `after` 연결 |
| `.env.example` | `TYPESAFE_API_KEY=` 추가 |
| `tests/db/category-source.db.test.ts` | 출처 기록·취소 상속·트리거·권한 |
| `tests/db/categorize.db.test.ts` | 거래 분류 통합 테스트 |
| `tests/db/ingest-api.db.test.ts` | 응답 후 분류 예약 테스트 추가 |

---

### Task 1: 카테고리 출처 기록 (DB)

**Files:**
- Create: `supabase/migrations/20261002000000_category_source.sql`
- Test: `tests/db/category-source.db.test.ts`

**Interfaces:**
- Produces: `transactions.category_source text null check in ('rule','ai','user')`; `app_settings` 키 `category_ai_min_confidence`(값 `0.7`); `ingest_sms`가 규칙으로 정한 카테고리는 `rule`, 취소는 원래 결제의 `category_id`·`category_source`를 이어받음.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/db/category-source.db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { APPROVAL, CANCEL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { adminClient, createGroupFixture } from "../helpers/db";

const db = adminClient();
const received = new Date("2026-09-23T08:40:00+09:00");
const MERCHANT = "테스트커피 강남역점(메가";

async function defaultCategoryId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function tx(id: string) {
  const { data, error } = await db.from("transactions").select("category_id, category_source").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("category_source", () => {
  it("설정값 category_ai_min_confidence는 0.7", async () => {
    const { data } = await db.from("app_settings").select("value").eq("key", "category_ai_min_confidence").single();
    expect(Number(data!.value)).toBe(0.7);
  });

  it("가맹점 규칙으로 정한 카테고리는 rule, 규칙이 없으면 비어 있다", async () => {
    const cafe = await defaultCategoryId("카페");
    const withRule = await createGroupFixture("src-rule");
    await db.from("merchant_rules").insert({ group_id: withRule.groupId, merchant_pattern: MERCHANT, category_id: cafe });
    const r1 = await ingestMessage(db, { userId: withRule.owner.userId, groupId: withRule.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    expect(await tx(r1.transactionId!)).toEqual({ category_id: cafe, category_source: "rule" });

    const noRule = await createGroupFixture("src-none");
    const r2 = await ingestMessage(db, { userId: noRule.owner.userId, groupId: noRule.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    expect(await tx(r2.transactionId!)).toEqual({ category_id: null, category_source: null });
  });

  it("자동 분류된 결제의 취소는 카테고리와 출처를 이어받는다", async () => {
    const cafe = await defaultCategoryId("카페");
    const g = await createGroupFixture("src-cancel");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    const appr = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source: "manual_test" });
    await db.from("transactions").update({ category_id: cafe, category_source: "ai" }).eq("id", appr.transactionId!);

    const cancel = await ingestMessage(db, owner, { body: CANCEL, receivedAt: received, source: "manual_test" });
    expect(await tx(cancel.transactionId!)).toEqual({ category_id: cafe, category_source: "ai" });
  });

  it("사용자가 카테고리를 바꾸면 user, 서버(service_role)가 바꾸면 그대로", async () => {
    const cafe = await defaultCategoryId("카페");
    const food = await defaultCategoryId("식비");
    const g = await createGroupFixture("src-user");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    const id = r.transactionId!;

    await db.from("transactions").update({ category_id: cafe, category_source: "ai" }).eq("id", id);
    expect(await tx(id)).toEqual({ category_id: cafe, category_source: "ai" });

    const { error } = await g.member.client.from("transactions").update({ category_id: food }).eq("id", id);
    expect(error).toBeNull();
    expect(await tx(id)).toEqual({ category_id: food, category_source: "user" });

    // 메모만 고치면 출처는 바뀌지 않는다
    await g.member.client.from("transactions").update({ memo: "점심" }).eq("id", id);
    expect(await tx(id)).toEqual({ category_id: food, category_source: "user" });

    // 미지정으로 되돌리면 출처도 비운다
    await g.member.client.from("transactions").update({ category_id: null }).eq("id", id);
    expect(await tx(id)).toEqual({ category_id: null, category_source: null });
  });

  it("사용자는 category_source를 직접 쓸 수 없다", async () => {
    const g = await createGroupFixture("src-deny");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
      { body: APPROVAL, receivedAt: received, source: "manual_test" });
    const { error } = await g.owner.client.from("transactions").update({ category_source: "ai" }).eq("id", r.transactionId!);
    expect(error?.code).toBe("42501");
  });

  it("사용자가 수동 입력에 카테고리를 넣으면 user", async () => {
    const food = await defaultCategoryId("식비");
    const g = await createGroupFixture("src-manual");
    const { data, error } = await g.owner.client.from("transactions").insert({
      group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 5000,
      merchant: "시장", occurred_at: "2026-09-23T03:00:00Z", category_id: food,
    }).select("id").single();
    expect(error).toBeNull();
    expect(await tx(data!.id)).toEqual({ category_id: food, category_source: "user" });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run tests/db/category-source.db.test.ts`
Expected: FAIL (`column transactions.category_source does not exist` 등)

- [ ] **Step 3: 마이그레이션 작성**

`supabase/migrations/20261002000000_category_source.sql`:

```sql
-- 거래 카테고리를 누가 정했는지: rule(가맹점 규칙), ai(jev 자동 분류), user(사용자)
alter table public.transactions
  add column category_source text check (category_source in ('rule', 'ai', 'user'));

-- jev 답의 확신이 이 값 이상일 때만 카테고리를 넣는다
insert into public.app_settings (key, value) values ('category_ai_min_confidence', '0.7');

-- 화면(authenticated)에서 카테고리를 넣거나 바꾸면 출처를 user로 바꾼다.
-- category_source는 authenticated에게 쓰기 권한이 없어 사용자가 직접 쓸 수 없다.
-- 카테고리가 비면(카테고리 삭제의 on delete set null 포함) 누가 바꿨든 출처도 비운다.
create function public.mark_user_category() returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.category_id is null then
    new.category_source := null;
  elsif current_user = 'authenticated'
     and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
    new.category_source := 'user';
  end if;
  return new;
end
$$;

create trigger transactions_mark_user_category
  before insert or update on public.transactions
  for each row execute function public.mark_user_category();

-- ingest_sms: 규칙으로 정한 카테고리는 rule로 기록하고,
-- 취소는 원래 결제의 카테고리·출처를 이어받는다. 나머지는 20261001000300과 같다.
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

  insert into public.transactions (
    group_id, user_id, raw_message_id, kind, amount, merchant, occurred_at, issuer,
    category_id, category_source, cancels_transaction_id
  ) values (
    p_group, p_user, v_raw_id, p_kind,
    case when p_kind = 'cancel' then -p_amount else p_amount end,
    p_merchant, p_occurred_at, p_issuer, v_category_id, v_category_source, v_cancels_id
  )
  returning id into v_tx_id;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;
```

`create or replace`는 같은 시그니처라 기존 `revoke`/`grant`(service_role 전용)가 유지된다.

- [ ] **Step 4: 마이그레이션 적용 후 테스트 통과 확인**

Run: `supabase db reset && pnpm vitest run tests/db/category-source.db.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan`
Expected: 모두 통과. 기존 `ingest-service`·`rls` 테스트도 그대로 통과해야 한다.

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add supabase/migrations/20261002000000_category_source.sql tests/db/category-source.db.test.ts
git commit -m "feat: 거래 카테고리 출처(rule/ai/user) 기록과 취소 시 카테고리 상속

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: TypeSafe 분류기

**Files:**
- Create: `src/categorize/typesafe.ts`
- Test: `src/categorize/typesafe.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CategoryOption = { id: string; name: string; hint: string | null };
  export type ClassifyAnswer = { name: string; confidence: number };
  export type CategoryClassifier = (merchant: string, options: CategoryOption[]) => Promise<ClassifyAnswer | null>;
  export function createTypesafeClassifier(opts: { apiKey: string; fetch?: typeof fetch; timeoutMs?: number }): CategoryClassifier;
  ```
  실패(네트워크·시간 초과·비정상 응답·형식 오류)는 모두 `null`을 돌려주고 예외를 던지지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/categorize/typesafe.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createTypesafeClassifier, type CategoryOption } from "./typesafe";

const options: CategoryOption[] = [
  { id: "c1", name: "카페", hint: "커피, 음료, 디저트 카페" },
  { id: "c2", name: "식비", hint: "음식점, 배달" },
  { id: "c3", name: "반려동물", hint: null },
];

const okResponse = (choice: string, confidence: number) =>
  new Response(JSON.stringify({
    model: "jev-1.13.0",
    answers: { category: { type: "choice", choice, confidence, probabilities: { [choice]: 1 } } },
    usage: { input_tokens: 300, output_tokens: 80 },
  }), { status: 200 });

describe("createTypesafeClassifier", () => {
  it("가맹점 이름과 카테고리만 Choice 질문으로 보내고 답을 돌려준다", async () => {
    const fetch = vi.fn(async () => okResponse("카페", 0.98));
    const classify = createTypesafeClassifier({ apiKey: "test-key", fetch });

    expect(await classify("테스트커피 강남역점(메가", options)).toEqual({ name: "카페", confidence: 0.98 });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("jev-latest");
    expect(body.questions.category.type).toBe("choice");
    expect(body.questions.category.instructions.merchant).toBe("테스트커피 강남역점(메가");
    expect(body.questions.category.criteria).toEqual({
      카페: "커피, 음료, 디저트 카페", 식비: "음식점, 배달", 반려동물: null,
    });
    // 금액·사람·날짜는 보내지 않는다
    expect(JSON.stringify(body)).not.toMatch(/12,?300|홍|09\/23/);
  });

  it("선택지가 2개 미만이면 호출하지 않고 null", async () => {
    const fetch = vi.fn(async () => okResponse("카페", 1));
    const classify = createTypesafeClassifier({ apiKey: "k", fetch });
    expect(await classify("가게", options.slice(0, 1))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("응답 코드가 200이 아니면 null", async () => {
    const classify = createTypesafeClassifier({ apiKey: "k", fetch: async () => new Response("{}", { status: 401 }) });
    expect(await classify("가게", options)).toBeNull();
  });

  it("응답 형식이 다르면 null", async () => {
    const classify = createTypesafeClassifier({
      apiKey: "k", fetch: async () => new Response(JSON.stringify({ answers: {} }), { status: 200 }),
    });
    expect(await classify("가게", options)).toBeNull();
  });

  it("네트워크 오류면 null", async () => {
    const classify = createTypesafeClassifier({ apiKey: "k", fetch: async () => { throw new TypeError("fetch failed"); } });
    expect(await classify("가게", options)).toBeNull();
  });

  it("시간 초과면 기다리지 않고 null", async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason));
      });
    const classify = createTypesafeClassifier({ apiKey: "k", fetch: hang, timeoutMs: 20 });
    const started = Date.now();
    expect(await classify("가게", options)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run src/categorize/typesafe.test.ts`
Expected: FAIL (`Cannot find module './typesafe'`)

- [ ] **Step 3: 구현**

`src/categorize/typesafe.ts`:

```ts
import { z } from "zod";

export type CategoryOption = { id: string; name: string; hint: string | null };
export type ClassifyAnswer = { name: string; confidence: number };
/** 가맹점 이름으로 카테고리 하나를 고른다. 실패하면 null(예외를 던지지 않는다). */
export type CategoryClassifier = (merchant: string, options: CategoryOption[]) => Promise<ClassifyAnswer | null>;

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const STATE = "한국 신용카드 결제 문자에서 뽑은 가맹점 이름이다. 문자 길이 제한으로 이름 끝이 잘려 있을 수 있다.";
const QUESTION = "`merchant` 가맹점에서 결제했다면 가계부의 어느 카테고리에 해당하나?";

const Response = z.object({
  answers: z.object({
    category: z.object({ choice: z.string(), confidence: z.number() }),
  }),
});

/**
 * TypeSafe(jev) Choice 질문으로 가맹점 카테고리를 고른다.
 * 가맹점 이름과 카테고리 이름·설명만 보낸다. 키와 가맹점 이름은 로그에 남기지 않는다.
 */
export function createTypesafeClassifier(opts: {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): CategoryClassifier {
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;

  return async (merchant, options) => {
    if (options.length < 2) return null;
    try {
      const res = await doFetch(ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "jev-latest",
          state: STATE,
          questions: {
            category: {
              type: "choice",
              instructions: { merchant, question: QUESTION },
              criteria: Object.fromEntries(options.map((o) => [o.name, o.hint])),
            },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        console.warn(`[categorize] TypeSafe 응답 ${res.status}`);
        return null;
      }
      const parsed = Response.safeParse(await res.json());
      if (!parsed.success) {
        console.warn("[categorize] TypeSafe 응답 형식이 다릅니다");
        return null;
      }
      const { choice, confidence } = parsed.data.answers.category;
      return { name: choice, confidence };
    } catch (e) {
      console.warn(`[categorize] TypeSafe 호출 실패: ${(e as Error).name}`);
      return null;
    }
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run src/categorize/typesafe.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 6: 커밋 (사용자 승인 후)**

```bash
git add src/categorize/typesafe.ts src/categorize/typesafe.test.ts
git commit -m "feat: TypeSafe(jev) 가맹점 카테고리 분류기 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 거래 분류와 저장

**Files:**
- Create: `src/categorize/categorize.ts`
- Test: `src/categorize/categorize.test.ts`, `tests/db/categorize.db.test.ts`

**Interfaces:**
- Consumes: Task 1의 `transactions.category_source`, `app_settings.category_ai_min_confidence`; Task 2의 `CategoryOption`, `ClassifyAnswer`, `CategoryClassifier`
- Produces:
  ```ts
  export type CategoryRow = { id: string; name: string; group_id: string | null };
  export function categoryOptions(rows: CategoryRow[]): CategoryOption[];
  export function pickCategory(answer: ClassifyAnswer | null, options: CategoryOption[], minConfidence: number): string | null;
  export type CategorizeOutcome = "categorized" | "undecided" | "skipped";
  export async function categorizeTransaction(db: SupabaseClient, classify: CategoryClassifier, transactionId: string): Promise<CategorizeOutcome>;
  ```
  `categorizeTransaction`은 DB 오류만 던진다(분류기 실패는 `undecided`).

- [ ] **Step 1: 실패하는 단위 테스트 작성**

`src/categorize/categorize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { categoryOptions, pickCategory } from "./categorize";

describe("categoryOptions", () => {
  it("기본 카테고리에는 설명을 붙이고, 이름이 같으면 그룹 카테고리를 쓴다", () => {
    const options = categoryOptions([
      { id: "d-cafe", name: "카페", group_id: null },
      { id: "d-food", name: "식비", group_id: null },
      { id: "g-cafe", name: "카페", group_id: "g1" },
      { id: "g-pet", name: "반려동물", group_id: "g1" },
    ]);
    expect(options).toEqual([
      { id: "g-cafe", name: "카페", hint: "커피, 음료, 디저트 카페" },
      { id: "d-food", name: "식비", hint: "음식점, 배달, 분식, 반찬 등 식사" },
      { id: "g-pet", name: "반려동물", hint: null },
    ]);
  });

  it("그룹 카테고리가 기본보다 먼저 와도 그룹 것을 쓴다", () => {
    const options = categoryOptions([
      { id: "g-cafe", name: "카페", group_id: "g1" },
      { id: "d-cafe", name: "카페", group_id: null },
    ]);
    expect(options.map((o) => o.id)).toEqual(["g-cafe"]);
  });
});

describe("pickCategory", () => {
  const options = [
    { id: "c-cafe", name: "카페", hint: null },
    { id: "c-etc", name: "기타", hint: null },
  ];

  it("확신이 기준 이상이면 카테고리 id", () => {
    expect(pickCategory({ name: "카페", confidence: 0.7 }, options, 0.7)).toBe("c-cafe");
  });

  it("확신이 기준 미만이면 null", () => {
    expect(pickCategory({ name: "카페", confidence: 0.69 }, options, 0.7)).toBeNull();
  });

  it("기타를 고르면 null", () => {
    expect(pickCategory({ name: "기타", confidence: 0.99 }, options, 0.7)).toBeNull();
  });

  it("선택지에 없는 이름이거나 답이 없으면 null", () => {
    expect(pickCategory({ name: "여행", confidence: 0.99 }, options, 0.7)).toBeNull();
    expect(pickCategory(null, options, 0.7)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패하는 DB 테스트 작성**

`tests/db/categorize.db.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { ingestMessage } from "@/ingest/service";
import { categorizeTransaction } from "@/categorize/categorize";
import type { CategoryClassifier, CategoryOption } from "@/categorize/typesafe";
import { adminClient, createGroupFixture, type GroupFixture } from "../helpers/db";

const db = adminClient();
const received = new Date("2026-09-23T08:40:00+09:00");

const answer = (name: string, confidence: number): CategoryClassifier => vi.fn(async () => ({ name, confidence }));

async function defaultCategoryId(name: string): Promise<string> {
  const { data, error } = await db.from("categories").select("id").is("group_id", null).eq("name", name).single();
  if (error) throw error;
  return data.id;
}

async function newApproval(label: string): Promise<{ g: GroupFixture; id: string }> {
  const g = await createGroupFixture(label);
  const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId },
    { body: APPROVAL, receivedAt: received, source: "manual_test" });
  return { g, id: r.transactionId! };
}

async function tx(id: string) {
  const { data, error } = await db.from("transactions").select("category_id, category_source").eq("id", id).single();
  if (error) throw error;
  return data;
}

describe("categorizeTransaction", () => {
  it("확신이 충분하면 카테고리를 넣고 출처는 ai", async () => {
    const { id } = await newApproval("cat-ok");
    const classify = answer("카페", 0.98);
    expect(await categorizeTransaction(db, classify, id)).toBe("categorized");
    expect(classify).toHaveBeenCalledWith("테스트커피 강남역점(메가", expect.any(Array));
    expect(await tx(id)).toEqual({ category_id: await defaultCategoryId("카페"), category_source: "ai" });
  });

  it("확신이 낮거나, 기타이거나, 분류기가 실패하면 미지정으로 둔다", async () => {
    for (const classify of [answer("카페", 0.5), answer("기타", 0.99), vi.fn(async () => null)]) {
      const { id } = await newApproval("cat-undecided");
      expect(await categorizeTransaction(db, classify, id)).toBe("undecided");
      expect(await tx(id)).toEqual({ category_id: null, category_source: null });
    }
  });

  it("이미 카테고리가 있으면 분류기를 부르지 않는다", async () => {
    const { id } = await newApproval("cat-skip");
    await db.from("transactions").update({ category_id: await defaultCategoryId("식비"), category_source: "rule" }).eq("id", id);
    const classify = answer("카페", 0.99);
    expect(await categorizeTransaction(db, classify, id)).toBe("skipped");
    expect(classify).not.toHaveBeenCalled();
  });

  it("jev가 답하는 사이 사용자가 고친 카테고리는 덮어쓰지 않는다", async () => {
    const { g, id } = await newApproval("cat-race");
    const food = await defaultCategoryId("식비");
    const classify: CategoryClassifier = async () => {
      await g.member.client.from("transactions").update({ category_id: food }).eq("id", id);
      return { name: "카페", confidence: 0.99 };
    };
    expect(await categorizeTransaction(db, classify, id)).toBe("skipped");
    expect(await tx(id)).toEqual({ category_id: food, category_source: "user" });
  });

  it("선택지는 기본 + 우리 그룹 카테고리이고, 다른 그룹 카테고리는 빠진다", async () => {
    const { g, id } = await newApproval("cat-options");
    const other = await createGroupFixture("cat-other");
    const { data: mine } = await db.from("categories")
      .insert({ group_id: g.groupId, name: "카페", sort_order: 10 }).select("id").single();
    await db.from("categories").insert({ group_id: other.groupId, name: "남의카테고리", sort_order: 10 });

    let seen: CategoryOption[] = [];
    const classify: CategoryClassifier = async (_m, options) => { seen = options; return { name: "카페", confidence: 0.99 }; };
    expect(await categorizeTransaction(db, classify, id)).toBe("categorized");

    const names = seen.map((o) => o.name);
    expect(names).not.toContain("남의카테고리");
    expect(names.filter((n) => n === "카페")).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining(["식비", "카페", "편의점", "교통", "쇼핑", "생활", "의료", "문화", "기타"]));
    expect(await tx(id)).toEqual({ category_id: mine!.id, category_source: "ai" });
  });

  it("수동 입력 거래는 분류하지 않는다", async () => {
    const g = await createGroupFixture("cat-manual");
    const { data } = await db.from("transactions").insert({
      group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 5000,
      merchant: "시장", occurred_at: "2026-09-23T03:00:00Z",
    }).select("id").single();
    const classify = answer("식비", 0.99);
    expect(await categorizeTransaction(db, classify, data!.id)).toBe("skipped");
    expect(classify).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `pnpm vitest run src/categorize/categorize.test.ts tests/db/categorize.db.test.ts`
Expected: FAIL (`Cannot find module './categorize'`)

- [ ] **Step 4: 구현**

`src/categorize/categorize.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryClassifier, CategoryOption, ClassifyAnswer } from "./typesafe";

export type CategoryRow = { id: string; name: string; group_id: string | null };
export type CategorizeOutcome = "categorized" | "undecided" | "skipped";

/** 기본 카테고리 설명. jev가 고를 때 참고한다. */
const CATEGORY_HINTS: Record<string, string> = {
  식비: "음식점, 배달, 분식, 반찬 등 식사",
  카페: "커피, 음료, 디저트 카페",
  편의점: "편의점",
  교통: "택시, 대중교통, 주유, 주차, 톨게이트",
  쇼핑: "온라인몰, 의류, 전자제품, 백화점 등 물건 구매",
  생활: "마트 장보기, 생활용품, 공과금, 통신비, 관리비",
  의료: "병원, 약국, 치과",
  문화: "영화, 공연, 책, 여가, 취미",
  기타: "위에 해당하지 않음",
};

/** jev가 골라도 미지정으로 두는 카테고리. 사실상 '모르겠다'는 뜻이라 사용자가 고르게 한다. */
const UNDECIDED_NAMES = new Set(["기타"]);

/** 선택지: 이름이 같으면 그룹 카테고리를 쓴다(jev 선택지 이름은 겹치면 안 된다). */
export function categoryOptions(rows: CategoryRow[]): CategoryOption[] {
  const byName = new Map<string, CategoryOption>();
  for (const row of rows) {
    if (byName.has(row.name) && row.group_id === null) continue;
    byName.set(row.name, { id: row.id, name: row.name, hint: CATEGORY_HINTS[row.name] ?? null });
  }
  return [...byName.values()];
}

/** jev 답을 카테고리 id로 바꾼다. 확신이 낮거나 '기타'·모르는 이름이면 null(미지정). */
export function pickCategory(
  answer: ClassifyAnswer | null,
  options: CategoryOption[],
  minConfidence: number,
): string | null {
  if (!answer || answer.confidence < minConfidence || UNDECIDED_NAMES.has(answer.name)) return null;
  return options.find((o) => o.name === answer.name)?.id ?? null;
}

/**
 * 카테고리가 비어 있는 결제·취소 거래를 jev로 분류해 저장한다.
 * 그 사이 사용자가 카테고리를 넣었으면 덮어쓰지 않는다. DB 오류만 던진다.
 */
export async function categorizeTransaction(
  db: SupabaseClient,
  classify: CategoryClassifier,
  transactionId: string,
): Promise<CategorizeOutcome> {
  const { data: tx, error } = await db
    .from("transactions")
    .select("group_id, kind, merchant, category_id")
    .eq("id", transactionId)
    .single();
  if (error) throw error;
  if (tx.category_id || tx.kind === "manual") return "skipped";

  const [categories, setting] = await Promise.all([
    db.from("categories").select("id, name, group_id")
      .or(`group_id.is.null,group_id.eq.${tx.group_id}`)
      .order("sort_order"),
    db.from("app_settings").select("value").eq("key", "category_ai_min_confidence").single(),
  ]);
  if (categories.error) throw categories.error;
  if (setting.error) throw setting.error;

  const options = categoryOptions(categories.data);
  const categoryId = pickCategory(await classify(tx.merchant, options), options, Number(setting.data.value));
  if (!categoryId) return "undecided";

  const { data: updated, error: updateError } = await db
    .from("transactions")
    .update({ category_id: categoryId, category_source: "ai" })
    .eq("id", transactionId)
    .is("category_id", null)
    .select("id");
  if (updateError) throw updateError;
  return updated.length > 0 ? "categorized" : "skipped";
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run src/categorize/categorize.test.ts tests/db/categorize.db.test.ts`
Expected: PASS (단위 6, DB 6)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/categorize/categorize.ts src/categorize/categorize.test.ts tests/db/categorize.db.test.ts
git commit -m "feat: 미지정 거래를 jev로 분류해 저장

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ingest 응답 후 자동 분류 연결

**Files:**
- Modify: `src/ingest/handler.ts` (`IngestDeps`, `handleIngest` 끝부분)
- Modify: `src/app/api/ingest/route.ts`
- Modify: `.env.example`
- Test: `tests/db/ingest-api.db.test.ts` (describe 추가)

**Interfaces:**
- Consumes: Task 2의 `CategoryClassifier`, `createTypesafeClassifier`; Task 3의 `categorizeTransaction`
- Produces: `IngestDeps`에 선택 항목 `classify?: CategoryClassifier | null`, `afterResponse?: (task: () => Promise<void>) => void`. 둘 다 있고 거래가 만들어졌을 때만 분류 작업을 예약한다. 예약된 작업은 예외를 밖으로 던지지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/db/ingest-api.db.test.ts` 끝에 추가(맨 위 import에 `vi`, `CategoryClassifier` 추가):

```ts
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CategoryClassifier } from "@/categorize/typesafe";
```

```ts
describe("응답 후 자동 분류", () => {
  async function setup(label: string, classify: CategoryClassifier | null) {
    const group = await createGroupFixture(label);
    const t = await issueIngestToken(group.owner.userId);
    const tasks: Array<() => Promise<void>> = [];
    const d: IngestDeps = { ...deps(), classify, afterResponse: (task) => { tasks.push(task); } };
    return { group, t, tasks, d };
  }

  async function categoryOf(groupId: string) {
    const { data } = await adminClient().from("transactions")
      .select("category_id, category_source").eq("group_id", groupId).single();
    return data;
  }

  it("응답은 분류를 기다리지 않고, 예약된 작업이 카테고리를 채운다", async () => {
    const classify = vi.fn<CategoryClassifier>(async () => ({ name: "카페", confidence: 0.98 }));
    const { group, t, tasks, d } = await setup("auto-ok", classify);

    const res = await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    expect(res.status).toBe(200);
    expect(classify).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);

    await tasks[0]();
    expect(await categoryOf(group.groupId)).toMatchObject({ category_source: "ai" });
  });

  it("같은 문자가 다시 오면(duplicate) 분류를 예약하지 않는다", async () => {
    const { t, tasks, d } = await setup("auto-dup", async () => ({ name: "카페", confidence: 0.98 }));
    await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    const again = await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    expect(await again.json()).toEqual({ status: "duplicate" });
    expect(tasks).toHaveLength(1);
  });

  it("키가 없으면(classify 없음) 예약하지 않는다", async () => {
    const { t, tasks, d } = await setup("auto-nokey", null);
    await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    expect(tasks).toHaveLength(0);
  });

  it("분류 중 예외가 나도 작업은 실패하지 않고 거래는 미지정으로 남는다", async () => {
    const { group, t, tasks, d } = await setup("auto-throw", async () => { throw new Error("boom"); });
    await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    await expect(tasks[0]()).resolves.toBeUndefined();
    expect(await categoryOf(group.groupId)).toEqual({ category_id: null, category_source: null });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run tests/db/ingest-api.db.test.ts`
Expected: FAIL (`tasks`가 비어 있음, `classify`/`afterResponse`가 `IngestDeps`에 없어 타입 오류)

- [ ] **Step 3: handler 수정**

`src/ingest/handler.ts` 상단 import에 추가:

```ts
import { categorizeTransaction } from "@/categorize/categorize";
import type { CategoryClassifier } from "@/categorize/typesafe";
```

`IngestDeps`에 두 항목 추가:

```ts
export type IngestDeps = {
  db: SupabaseClient;
  /** 인증된 사용자별 제한 (스펙: 토큰당 분당 30회) */
  tokenLimiter: RateLimiter;
  /** 토큰 확인(DB 조회) 전에 거는 IP별 제한 */
  ipLimiter: RateLimiter;
  now: () => Date;
  /** 카테고리 자동 분류기. 없으면(키 미설정) 분류하지 않는다. */
  classify?: CategoryClassifier | null;
  /** 응답을 보낸 뒤 실행할 작업을 예약한다(라우트에서는 Next.js after). */
  afterResponse?: (task: () => Promise<void>) => void;
};
```

`handleIngest` 끝의 `return json(200, result);`를 다음으로 바꾼다:

```ts
  const { classify, afterResponse } = deps;
  const transactionId = result.transactionId;
  if (transactionId && classify && afterResponse) {
    afterResponse(async () => {
      try {
        await categorizeTransaction(deps.db, classify, transactionId);
      } catch (e) {
        console.warn(`[categorize] 거래 ${transactionId} 분류 실패: ${(e as Error).message}`);
      }
    });
  }
  return json(200, result);
```

- [ ] **Step 4: route와 .env.example 수정**

`src/app/api/ingest/route.ts`:

```ts
import { after } from "next/server";
import { createTypesafeClassifier } from "@/categorize/typesafe";
import { handleIngest } from "@/ingest/handler";
import { createRateLimiter } from "@/ingest/rate-limit";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const ipLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export async function POST(req: Request): Promise<Response> {
  const typesafeKey = process.env.TYPESAFE_API_KEY;
  return handleIngest(req, {
    db: createAdminClient(),
    tokenLimiter,
    ipLimiter,
    now: () => new Date(),
    classify: typesafeKey ? createTypesafeClassifier({ apiKey: typesafeKey }) : null,
    afterResponse: after,
  });
}
```

`.env.example` 끝에 추가:

```bash
# TypeSafe(jev) 카테고리 자동 분류. 비워 두면 분류하지 않는다(서버 전용)
TYPESAFE_API_KEY=
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run tests/db/ingest-api.db.test.ts`
Expected: PASS (기존 6 + 새 4)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 실제 jev로 한 번 확인 (사용자 승인 후, 외부 호출 1회)**

로컬 서버(`pnpm dev`)에 테스트 토큰으로 가상 문자 `APPROVAL`을 보낸 뒤, 몇 초 후 그 거래의 `category_source`가 `ai`이고 카테고리가 "카페"인지 DB에서 확인한다. 키는 `~/.zshenv`가 설정한 `TYPESAFE_API_KEY`를 쓰고 출력하지 않는다. 확인한 거래는 테스트 그룹 것이라 지우지 않아도 된다.

- [ ] **Step 8: 커밋 (사용자 승인 후)**

```bash
git add src/ingest/handler.ts src/app/api/ingest/route.ts .env.example tests/db/ingest-api.db.test.ts
git commit -m "feat: 결제 문자 저장 후 jev 카테고리 자동 분류 연결

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 범위 밖 (후속)

- 화면의 "자동 분류" 표시와 카테고리 수정 → 규칙 학습: 화면 단계(스펙 6장)에서 `category_source`를 써서 만든다.
- NAS 배포 환경의 `TYPESAFE_API_KEY` 설정: 배포 계획에서 다룬다.
- 기준값 0.7 재점검: 실제 문자가 쌓이면 `ai` 거래 중 사용자가 고친 비율을 보고 `app_settings`에서 조정한다.
