# 백엔드 핵심 (계획 1/4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드 결제 문자를 `POST /api/ingest`로 받아 분석·중복 확인·취소 연결을 거쳐 그룹별 거래로 저장하고, 다른 그룹 데이터는 RLS로 차단되는 백엔드를 만든다.

**Architecture:** Next.js(App Router) 앱 하나에 ingest API 라우트를 둔다. 라우트는 얇게 유지하고 실제 로직은 프레임워크와 무관한 모듈(`src/parsers`, `src/ingest`)에 둔다. 데이터는 Supabase(Postgres)에 저장하고, 화면용 접근은 RLS로, 서버 작업은 `service_role` 키로 한다. 로컬 Supabase(Docker)에서 DB·RLS·ingest를 통합 테스트한다.

**Tech Stack:** Next.js(TypeScript, App Router, pnpm), Vitest, Zod, @supabase/supabase-js v2, Supabase CLI + Docker Desktop, gitleaks

**Spec:** `docs/superpowers/specs/2026-10-01-nof-payments-book-design.md`

이 계획의 범위는 스펙 10장 구현 순서의 1~4단계(기본 틀, DB·RLS, 분석기, ingest API)다. 인증·초대(`accept_invite` 포함), 화면, 예산, 배포는 계획 2~4에서 다룬다.

## Global Constraints

- 작업 원칙: **각 Task 시작 전과 모든 커밋 전에 사용자 승인**을 받는다. 설치(brew 등)도 승인 대상이다.
- 공개 저장소: 실제 문자, 사이트 주소, NAS 접속 정보, 비밀값은 커밋하지 않는다. 비밀값은 `.env*`에만 둔다(`.env.example`만 커밋).
- 테스트 픽스처의 문자는 금액·가맹점·카드번호·이름·누적액을 가상 값으로 바꾼다. 줄 구성과 표기 형식만 실제와 같게 유지한다.
- 설정값은 하드코딩하지 않고 `app_settings`에 둔다: `max_group_members`=2, `max_users`=30, `invite_ttl_days`=7, `raw_message_retention_days`=365, `budget_warning_ratio`=0.8.
- 토큰·초대 값은 32바이트 무작위 값, DB에는 SHA-256 해시(hex)만 저장한다.
- `service_role` 키는 서버 코드에서만 읽는다. 환경변수 이름에 `NEXT_PUBLIC_`을 붙이지 않는다.
- ingest 토큰당 분당 30회 제한, 초과 시 `429`.
- 시간대: 문자 속 일시는 한국 시간(KST, UTC+9)으로 해석한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.

## Review Focus

1. **승인 → 취소 → 같은 금액 재승인이 1~2분 안에 연달아 오는 경우**: 취소는 그 이전의 미취소 승인 하나에만 연결되고, 재승인은 별도 거래로 남아 합계가 재승인 금액과 같아야 한다. → Task 5 테스트
2. **원 승인 없이 취소 문자만 오는 경우**(서비스 시작 전 결제의 취소): 음수 단독 거래로 저장돼야 한다. → Task 5 테스트
3. **새해 직후 KST/UTC 경계**: `01/01 00:10` 문자를 KST 1월 1일 00:12(UTC로는 전년 12월 31일)에 받으면 올해 1월 1일 거래여야 한다. → Task 4 테스트
4. **안드로이드 전달 앱이 형식을 바꾸는 경우**: `[Web발신]` 머리말 없음, CRLF 줄바꿈, 줄 끝 공백이 있어도 똑같이 분석돼야 한다. → Task 4 테스트
5. **`receivedAt` 누락**(단축어·MacroDroid 설정 실수): 서버 수신 시각으로 대체해 저장돼야 하고, 형식이 틀린 값은 `400`이어야 한다. → Task 6 테스트

## 스펙과 다르게 구체화한 부분

- `raw_messages.status`의 DB 값은 `parsed`/`unparsed`/`ignored` 세 가지다. `duplicate`는 unique 제약으로 행을 만들지 않으므로 **API 응답 상태로만** 존재한다.
- `merchant_rules.merchant_pattern`은 v1에서 **가맹점 원문과 정확히 일치**하는 규칙으로 쓴다(국민카드 문자는 가맹점이 잘려 오므로 원문 그대로가 가장 안정적이다).
- 할부(`3개월` 등) 표기는 해석하지만 실제 문자로 검증하지 못했다. 거래에는 할부 정보를 저장하지 않는다(v1 범위 밖).

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/parsers/types.ts` | `CardSmsParser`, `ParseResult` 타입 |
| `src/parsers/kst.ts` | KST 날짜 계산, 연도 추론 |
| `src/parsers/kb-card.ts` | 국민카드 문자 분석기 |
| `src/parsers/index.ts` | 분석기 목록, `parseSms` |
| `src/parsers/__fixtures__/kb-card.ts` | 가상화한 국민카드 문자 픽스처 |
| `src/lib/hash.ts` | `sha256Hex`, `randomToken` |
| `src/lib/supabase-admin.ts` | `service_role` 서버 클라이언트 생성 |
| `src/ingest/mask.ts` | 원문 마스킹 |
| `src/ingest/auth.ts` | ingest 토큰 → 사용자·그룹 확인 |
| `src/ingest/service.ts` | 원문 저장·중복·분석·거래 생성 |
| `src/ingest/rate-limit.ts` | 토큰별 분당 요청 제한 |
| `src/ingest/handler.ts` | HTTP 요청 검증과 응답 |
| `src/app/api/ingest/route.ts` | Next.js 라우트(의존성 연결만) |
| `supabase/migrations/*.sql` | 스키마, RLS, DB 함수 |
| `tests/helpers/db.ts` | DB 테스트용 사용자·그룹·토큰 생성 |
| `tests/db/*.db.test.ts` | 로컬 Supabase 통합 테스트 |
| `scripts/write-test-env.sh` | 로컬 Supabase 접속값을 `.env.test.local`로 기록 |

단위 테스트는 `src/**/*.test.ts`(`pnpm test`), DB 통합 테스트는 `tests/db/**`(`pnpm test:db`, 로컬 Supabase 필요)로 나눈다.

---

### Task 1: 프로젝트 기본 틀

**Files:**
- Create: Next.js 기본 파일 일체(`package.json`, `src/app/*`, `tsconfig.json`, `eslint.config.mjs` 등)
- Modify: `next.config.ts`(`output: "standalone"`)
- Create: `vitest.config.ts`, `src/lib/hash.ts`, `src/lib/hash.test.ts`, `.env.example`, `.githooks/pre-commit`
- Modify: `.gitignore`, `README.md`

**Interfaces:**
- Produces: `sha256Hex(value: string): string`(64자 hex), `randomToken(): string`(32바이트 base64url, 43자). 스크립트 `pnpm test`, `pnpm test:db`, `pnpm secrets:scan`.

- [ ] **Step 1: 승인 확인 후 gitleaks 설치**

사용자에게 `brew install gitleaks` 설치 승인을 받는다.

```bash
brew install gitleaks
gitleaks version
```
Expected: 버전(8.19 이상) 출력

- [ ] **Step 2: Next.js 앱을 임시 폴더에 생성해 복사**

`create-next-app`은 `README.md`가 있는 폴더에 생성할 수 없으므로 옆 폴더에 만든 뒤 복사한다.

```bash
cd ~/dev
pnpm create next-app@latest nof-scaffold --ts --app --src-dir --eslint --tailwind --import-alias "@/*" --use-pnpm --yes
rsync -a --exclude .git --exclude README.md --exclude .gitignore --exclude node_modules nof-scaffold/ nof-payments-book/
rm -rf nof-scaffold
cd nof-payments-book && pnpm install
```
질문이 나오면 기본값을 고른다(Turbopack 여부 등).

- [ ] **Step 3: `.gitignore`에 Next.js 항목 추가**

`.gitignore` 끝에 추가:

```gitignore

# Next.js·테스트
next-env.d.ts
*.tsbuildinfo
coverage/
supabase/.temp/
supabase/.branches/
```

- [ ] **Step 4: Vitest·Zod·Supabase 클라이언트 설치와 설정**

```bash
pnpm add zod @supabase/supabase-js
pnpm add -D vitest vite-tsconfig-paths
```

`vitest.config.ts`:

```ts
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // .env.test.local 등 테스트용 환경변수를 읽는다
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 20_000,
  },
});
```

`package.json`의 `scripts`에 추가:

```json
"test": "vitest run src",
"test:db": "vitest run tests/db",
"secrets:scan": "gitleaks git --redact ."
```

- [ ] **Step 5: 실패하는 테스트 작성** — `src/lib/hash.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { randomToken, sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("알려진 값의 SHA-256 hex를 돌려준다", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("한글도 UTF-8로 해시한다", () => {
    expect(sha256Hex("국민")).toHaveLength(64);
    expect(sha256Hex("국민")).not.toBe(sha256Hex("국 민"));
  });
});

describe("randomToken", () => {
  it("32바이트 base64url(43자)이며 매번 다르다", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `pnpm test`
Expected: FAIL — `Failed to resolve import "./hash"`

- [ ] **Step 7: 구현** — `src/lib/hash.ts`

```ts
import { createHash, randomBytes } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
```

- [ ] **Step 8: 통과 확인**

Run: `pnpm test`
Expected: 3 passed

- [ ] **Step 9: `.env.example`과 커밋 전 비밀값 검사 훅**

`.env.example`:

```dotenv
# Supabase (서버 전용 키에는 NEXT_PUBLIC_을 붙이지 않는다)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`.githooks/pre-commit`:

```sh
#!/bin/sh
# 스테이징된 변경에 비밀값이 있으면 커밋을 막는다.
exec gitleaks git --pre-commit --staged --redact --verbose
```

```bash
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
pnpm secrets:scan
```
Expected: `no leaks found`

- [ ] **Step 10: README에 개발 방법 추가**

`README.md`를 다음으로 바꾼다:

````markdown
# nof-payments-book

카드 결제 문자를 모아 부부·커플 그룹이 함께 쓰는 가계부.

- 현황: [docs/status.md](docs/status.md)
- 설계: [docs/superpowers/specs/2026-10-01-nof-payments-book-design.md](docs/superpowers/specs/2026-10-01-nof-payments-book-design.md)

## 개발

```bash
pnpm install
git config core.hooksPath .githooks   # 커밋 전 gitleaks 검사
pnpm test                              # 단위 테스트
```

비밀값은 `.env.local`에만 두고, 키 이름은 `.env.example`을 참고한다.
````

- [ ] **Step 11: NAS 배포 대비 standalone 출력 설정** — `next.config.ts`

Docker 이미지를 작게 만들기 위해 실행에 필요한 파일만 `.next/standalone`에 모은다.

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 12: 빌드·린트 확인**

Run: `pnpm lint && pnpm build && test -f .next/standalone/server.js && echo standalone-ok`
Expected: 오류 없이 완료, 마지막 줄 `standalone-ok`

- [ ] **Step 13: 사용자 승인 후 커밋**

```bash
git add -A
git commit -m "chore: Next.js·Vitest 기본 틀과 비밀값 검사 훅 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 로컬 Supabase와 초기 스키마

**Files:**
- Create: (`supabase/config.toml`은 미리 생성됨) `supabase/migrations/20261001000000_init.sql`, `scripts/write-test-env.sh`, `tests/db/schema.db.test.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: 테이블 `app_settings`, `profiles`, `groups`, `group_members`, `service_invites`, `group_invites`, `ingest_tokens`, `categories`, `merchant_rules`, `raw_messages`, `transactions`, `budgets`. `.env.test.local`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: 승인 확인 후 Docker Desktop 설치**

Supabase CLI(2.119.0)와 `supabase init`, 클라우드 프로젝트 연결(`supabase link`)은 계획 작성 후 미리 끝냈다. 여기서는 Docker만 설치한다. 사용자에게 설치 승인을 받는다.

```bash
brew install --cask docker
open -a Docker            # 첫 실행 시 사용자가 약관 동의 필요
docker info >/dev/null && supabase --version
```
Expected: Supabase CLI 버전 출력

- [ ] **Step 2: 로컬 Supabase 실행**

```bash
supabase start
```
Expected: `API URL: http://127.0.0.1:54321` 등 접속 정보 출력

- [ ] **Step 3: 테스트용 접속값 기록 스크립트** — `scripts/write-test-env.sh`

```sh
#!/bin/sh
# 로컬 Supabase 접속값을 .env.test.local에 기록한다. (로컬 전용 키, 커밋 금지)
set -e
eval "$(supabase status -o env)"
cat > .env.test.local <<EOF
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EOF
echo "wrote .env.test.local"
```

```bash
chmod +x scripts/write-test-env.sh
./scripts/write-test-env.sh
grep -c "=." .env.test.local
```
Expected: `3`. 값이 비어 있으면 `supabase status -o env` 출력의 변수 이름을 확인해 스크립트를 맞춘다(CLI 버전에 따라 `PUBLISHABLE_KEY`/`SECRET_KEY`일 수 있다).

- [ ] **Step 4: 실패하는 스키마 테스트** — `tests/db/schema.db.test.ts`

```ts
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

describe("초기 스키마", () => {
  it("설정값이 스펙의 기본값으로 들어 있다", async () => {
    const { data, error } = await admin.from("app_settings").select("key, value");
    expect(error).toBeNull();
    const settings = Object.fromEntries(data!.map((r) => [r.key, r.value]));
    expect(settings).toEqual({
      max_group_members: 2,
      max_users: 30,
      invite_ttl_days: 7,
      raw_message_retention_days: 365,
      budget_warning_ratio: 0.8,
    });
  });

  it("기본 카테고리(group_id null)가 들어 있다", async () => {
    const { data, error } = await admin
      .from("categories")
      .select("name")
      .is("group_id", null)
      .order("sort_order");
    expect(error).toBeNull();
    expect(data!.map((c) => c.name)).toEqual([
      "식비", "카페", "편의점", "교통", "쇼핑", "생활", "의료", "문화", "기타",
    ]);
  });
});
```

- [ ] **Step 5: 실패 확인**

Run: `pnpm test:db`
Expected: FAIL — `relation "public.app_settings" does not exist` 또는 `Could not find the table`

- [ ] **Step 6: 스키마 마이그레이션** — `supabase/migrations/20261001000000_init.sql`

```sql
-- 설정값
create table public.app_settings (
  key text primary key,
  value jsonb not null
);

insert into public.app_settings (key, value) values
  ('max_group_members', '2'),
  ('max_users', '30'),
  ('invite_ttl_days', '7'),
  ('raw_message_retention_days', '365'),
  ('budget_warning_ratio', '0.8');

-- 사용자
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_operator boolean not null default false,
  can_create_group boolean not null default false,
  created_at timestamptz not null default now()
);

-- 그룹
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (user_id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null unique references public.profiles (user_id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 초대 (수락 로직은 계획 2)
create table public.service_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid not null references public.profiles (user_id),
  expires_at timestamptz not null,
  used_by uuid references public.profiles (user_id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles (user_id),
  expires_at timestamptz not null,
  used_by uuid references public.profiles (user_id),
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 기기 전송 토큰
create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  token_hash text not null unique,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- 카테고리
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

insert into public.categories (group_id, name, sort_order) values
  (null, '식비', 1), (null, '카페', 2), (null, '편의점', 3),
  (null, '교통', 4), (null, '쇼핑', 5), (null, '생활', 6),
  (null, '의료', 7), (null, '문화', 8), (null, '기타', 9);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  merchant_pattern text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  unique (group_id, merchant_pattern)
);

-- 문자 원문과 거래
create table public.raw_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  body text not null,
  body_hash text not null,
  source text not null,
  received_at timestamptz not null,
  status text not null check (status in ('parsed', 'unparsed', 'ignored')),
  parser_id text,
  created_at timestamptz not null default now(),
  unique (user_id, body_hash)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id),
  raw_message_id uuid references public.raw_messages (id) on delete set null,
  kind text not null check (kind in ('approval', 'cancel', 'manual')),
  amount bigint not null,
  merchant text not null,
  occurred_at timestamptz not null,
  issuer text,
  category_id uuid references public.categories (id) on delete set null,
  cancels_transaction_id uuid references public.transactions (id) on delete set null,
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- 승인 하나에는 취소 하나만 연결된다
create unique index transactions_one_cancel_per_approval
  on public.transactions (cancels_transaction_id)
  where cancels_transaction_id is not null;

create index transactions_group_occurred on public.transactions (group_id, occurred_at desc);

-- 예산 (month는 해당 월 1일)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount bigint not null check (amount > 0),
  unique nulls not distinct (group_id, category_id, month)
);
```

- [ ] **Step 7: 적용과 통과 확인**

```bash
supabase db reset
pnpm test:db
```
Expected: 2 passed

클라우드 DB(`supabase db push`)에는 적용하지 않는다. 클라우드 적용은 계획 1을 마친 뒤 사용자 승인을 받아 따로 한다.

- [ ] **Step 8: README에 DB 테스트 방법 추가**

`README.md`의 `## 개발` 코드 블록 아래에 추가:

````markdown
### DB 테스트 (Docker Desktop + Supabase CLI 필요)

```bash
supabase start
./scripts/write-test-env.sh   # .env.test.local 생성 (커밋 금지)
supabase db reset             # 마이그레이션 적용
pnpm test:db
```
````

- [ ] **Step 9: 사용자 승인 후 커밋**

```bash
git add supabase scripts tests README.md
git commit -m "feat: Supabase 초기 스키마와 로컬 DB 테스트 환경 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: RLS 정책과 그룹 격리 테스트

**Files:**
- Create: `supabase/migrations/20261001000100_rls.sql`, `tests/helpers/db.ts`, `tests/db/rls.db.test.ts`

**Interfaces:**
- Consumes: Task 2의 테이블, Task 1의 `randomToken`, `sha256Hex`
- Produces:
  - SQL 함수 `public.my_group_id() returns uuid` (로그인 사용자의 그룹 id)
  - `tests/helpers/db.ts`:
    - `adminClient(): SupabaseClient`
    - `createGroupFixture(label: string): Promise<GroupFixture>`
    - `issueIngestToken(userId: string): Promise<string>` (원문 토큰 반환)
    - `type TestUser = { userId: string; client: SupabaseClient }`
    - `type GroupFixture = { groupId: string; owner: TestUser; member: TestUser }`
    - `createLoneUser(label: string): Promise<TestUser>` (그룹 없는 사용자)

- [ ] **Step 1: 테스트 헬퍼 작성** — `tests/helpers/db.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { randomToken, sha256Hex } from "@/lib/hash";

const url = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "test-password-1234";

export type TestUser = { userId: string; client: SupabaseClient };
export type GroupFixture = { groupId: string; owner: TestUser; member: TestUser };

export function adminClient(): SupabaseClient {
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

async function must<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data;
}

export async function createLoneUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `${label}-${randomUUID()}@test.local`;
  const created = await must(
    admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }),
  );
  const userId = created.user!.id;
  await must(admin.from("profiles").insert({ user_id: userId, display_name: label }));

  const client = anonClient();
  await must(client.auth.signInWithPassword({ email, password: PASSWORD }));
  return { userId, client };
}

export async function createGroupFixture(label: string): Promise<GroupFixture> {
  const admin = adminClient();
  const owner = await createLoneUser(`${label}-owner`);
  const member = await createLoneUser(`${label}-member`);
  const group = await must(
    admin.from("groups").insert({ name: `${label} 가계부`, owner_id: owner.userId }).select("id").single(),
  );
  await must(
    admin.from("group_members").insert([
      { group_id: group.id, user_id: owner.userId, role: "owner" },
      { group_id: group.id, user_id: member.userId, role: "member" },
    ]),
  );
  return { groupId: group.id, owner, member };
}

export async function issueIngestToken(userId: string): Promise<string> {
  const token = randomToken();
  await must(
    adminClient().from("ingest_tokens").insert({ user_id: userId, token_hash: sha256Hex(token), label: "test" }),
  );
  return token;
}
```

- [ ] **Step 2: 실패하는 격리 테스트** — `tests/db/rls.db.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createGroupFixture, type GroupFixture } from "../helpers/db";

let a: GroupFixture;
let b: GroupFixture;
let bCategoryId: string;

beforeAll(async () => {
  a = await createGroupFixture("a");
  b = await createGroupFixture("b");
  const admin = adminClient();

  const raw = await admin
    .from("raw_messages")
    .insert({
      group_id: b.groupId, user_id: b.owner.userId, body: "b 원문", body_hash: `h-${b.groupId}`,
      source: "manual_test", received_at: new Date().toISOString(), status: "unparsed",
    })
    .select("id").single();
  if (raw.error) throw raw.error;

  const tx = await admin.from("transactions").insert({
    group_id: b.groupId, user_id: b.owner.userId, kind: "manual", amount: 1000,
    merchant: "B가게", occurred_at: new Date().toISOString(),
  });
  if (tx.error) throw tx.error;

  const cat = await admin.from("categories").insert({ group_id: b.groupId, name: "B전용" }).select("id").single();
  if (cat.error) throw cat.error;
  bCategoryId = cat.data.id;
});

describe("그룹 격리 RLS", () => {
  it("같은 그룹 거래는 그룹원 모두 볼 수 있다", async () => {
    const { data, error } = await b.member.client.from("transactions").select("merchant");
    expect(error).toBeNull();
    expect(data).toEqual([{ merchant: "B가게" }]);
  });

  it("다른 그룹 거래·원문은 보이지 않는다", async () => {
    const tx = await a.owner.client.from("transactions").select("id").eq("group_id", b.groupId);
    const raw = await a.owner.client.from("raw_messages").select("id").eq("group_id", b.groupId);
    expect(tx.data).toEqual([]);
    expect(raw.data).toEqual([]);
  });

  it("다른 그룹에 거래를 넣을 수 없다", async () => {
    const { error } = await a.owner.client.from("transactions").insert({
      group_id: b.groupId, user_id: a.owner.userId, kind: "manual", amount: 1,
      merchant: "침입", occurred_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("자기 그룹에도 수동 입력(manual) 외 거래는 직접 넣을 수 없다", async () => {
    const { error } = await a.owner.client.from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "approval", amount: 1,
      merchant: "위조", occurred_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("기본 카테고리와 자기 그룹 카테고리만 보인다", async () => {
    const { data } = await a.owner.client.from("categories").select("id, group_id");
    expect(data!.some((c) => c.id === bCategoryId)).toBe(false);
    expect(data!.filter((c) => c.group_id === null)).toHaveLength(9);
  });

  it("다른 그룹 카테고리는 수정되지 않는다", async () => {
    const { data } = await a.owner.client
      .from("categories").update({ name: "탈취" }).eq("id", bCategoryId).select("id");
    expect(data).toEqual([]);
  });

  it("자기 운영자 권한을 켤 수 없다", async () => {
    const { error } = await a.owner.client
      .from("profiles").update({ is_operator: true }).eq("user_id", a.owner.userId);
    expect(error).not.toBeNull();
  });

  it("다른 사용자의 ingest 토큰은 보이지 않는다", async () => {
    const admin = adminClient();
    await admin.from("ingest_tokens").insert({ user_id: b.owner.userId, token_hash: `t-${b.groupId}` });
    const { data } = await a.owner.client.from("ingest_tokens").select("id");
    expect(data).toEqual([]);
  });

  it("로그인하지 않으면 아무것도 볼 수 없다", async () => {
    const { data } = await anonClient().from("transactions").select("id");
    expect(data ?? []).toEqual([]);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm test:db`
Expected: FAIL — 다른 그룹 거래가 조회되거나(`expected [...] to deeply equal []`) 침입 insert가 성공함

- [ ] **Step 4: RLS 마이그레이션** — `supabase/migrations/20261001000100_rls.sql`

```sql
-- 로그인 사용자의 그룹 id (한 사람 한 그룹)
create function public.my_group_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select group_id from public.group_members where user_id = auth.uid()
$$;

revoke execute on function public.my_group_id() from public, anon;
grant execute on function public.my_group_id() to authenticated;

-- 권한: anon은 아무것도 못 하고, authenticated는 RLS 범위 안에서만
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.service_invites enable row level security;
alter table public.group_invites enable row level security;
alter table public.ingest_tokens enable row level security;
alter table public.categories enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.raw_messages enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- 설정: 읽기만
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

-- 프로필: 나와 같은 그룹 사람만 보고, 내 이름만 고친다
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or user_id in (select user_id from public.group_members where group_id = public.my_group_id())
  );
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 그룹: 내 그룹만 보고, 그룹장만 이름을 고친다
create policy groups_read on public.groups
  for select to authenticated using (id = public.my_group_id());
create policy groups_update_owner on public.groups
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke insert, update, delete on public.groups from authenticated;
grant update (name) on public.groups to authenticated;

-- 그룹 구성원: 읽기만 (가입·탈퇴는 서버 함수)
create policy group_members_read on public.group_members
  for select to authenticated using (group_id = public.my_group_id());
revoke insert, update, delete on public.group_members from authenticated;

-- 초대: 계획 2에서 정책 추가 전까지 사용자 접근 없음
revoke all on public.service_invites, public.group_invites from authenticated;

-- ingest 토큰: 내 것만 보고, 이름·폐기만 고친다 (발급은 서버)
create policy ingest_tokens_read_own on public.ingest_tokens
  for select to authenticated using (user_id = auth.uid());
create policy ingest_tokens_update_own on public.ingest_tokens
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.ingest_tokens from authenticated;
grant update (label, revoked_at) on public.ingest_tokens to authenticated;

-- 카테고리: 기본 + 내 그룹 것을 보고, 내 그룹 것만 고친다
create policy categories_read on public.categories
  for select to authenticated
  using (group_id is null or group_id = public.my_group_id());
create policy categories_write on public.categories
  for insert to authenticated with check (group_id = public.my_group_id());
create policy categories_update on public.categories
  for update to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
create policy categories_delete on public.categories
  for delete to authenticated using (group_id = public.my_group_id());

-- 가맹점 규칙·예산: 내 그룹 전체 권한
create policy merchant_rules_group on public.merchant_rules
  for all to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
create policy budgets_group on public.budgets
  for all to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());

-- 원문: 내 그룹 것을 보고, 상태만 고친다 (저장은 서버)
create policy raw_messages_read on public.raw_messages
  for select to authenticated using (group_id = public.my_group_id());
create policy raw_messages_update on public.raw_messages
  for update to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
revoke insert, update, delete on public.raw_messages from authenticated;
grant update (status) on public.raw_messages to authenticated;

-- 거래: 내 그룹 것을 보고 고치며, 직접 넣는 것은 수동 입력만
create policy transactions_read on public.transactions
  for select to authenticated using (group_id = public.my_group_id());
create policy transactions_insert_manual on public.transactions
  for insert to authenticated
  with check (
    group_id = public.my_group_id()
    and kind = 'manual'
    and user_id in (select user_id from public.group_members where group_id = public.my_group_id())
  );
create policy transactions_update on public.transactions
  for update to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
create policy transactions_delete on public.transactions
  for delete to authenticated using (group_id = public.my_group_id());
revoke update on public.transactions from authenticated;
grant update (category_id, memo, amount, merchant, occurred_at, user_id) on public.transactions to authenticated;
```

- [ ] **Step 5: 적용과 통과 확인**

```bash
supabase db reset
pnpm test:db
```
Expected: schema 2개 + rls 9개 모두 passed

- [ ] **Step 6: 사용자 승인 후 커밋**

```bash
git add supabase/migrations tests
git commit -m "feat: 그룹 격리 RLS 정책과 격리 테스트 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 국민카드 문자 분석기

**Files:**
- Create: `src/parsers/types.ts`, `src/parsers/kst.ts`, `src/parsers/kst.test.ts`, `src/parsers/kb-card.ts`, `src/parsers/kb-card.test.ts`, `src/parsers/index.ts`, `src/parsers/index.test.ts`, `src/parsers/__fixtures__/kb-card.ts`

**Interfaces:**
- Produces:
  - `type ParseResult = { kind: "approval" | "cancel"; amount: number; merchant: string; occurredAt: Date; issuer: string } | { kind: "ignore"; reason: string } | { kind: "unknown" }` (`amount`는 항상 양수)
  - `interface CardSmsParser { id: string; canParse(body: string): boolean; parse(body: string, receivedAt: Date): ParseResult }`
  - `parseSms(body: string, receivedAt: Date): { parserId: string | null; result: ParseResult }`
  - `kstDate(year, month, day, hour, minute): Date`, `inferYear(messageMonth: number, receivedAt: Date): number`

- [ ] **Step 1: 타입** — `src/parsers/types.ts`

```ts
export type ParseResult =
  | {
      kind: "approval" | "cancel";
      /** 결제·취소 금액(항상 양수). 누적 사용액이 아니다. */
      amount: number;
      /** 문자에 찍힌 가맹점 원문(잘려 있을 수 있음) */
      merchant: string;
      occurredAt: Date;
      issuer: string;
    }
  | { kind: "ignore"; reason: string }
  | { kind: "unknown" };

export interface CardSmsParser {
  id: string;
  canParse(body: string): boolean;
  parse(body: string, receivedAt: Date): ParseResult;
}
```

- [ ] **Step 2: 실패하는 KST 테스트** — `src/parsers/kst.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { inferYear, kstDate } from "./kst";

describe("kstDate", () => {
  it("KST 시각을 UTC Date로 만든다", () => {
    expect(kstDate(2026, 9, 23, 8, 26).toISOString()).toBe("2026-09-22T23:26:00.000Z");
  });
});

describe("inferYear", () => {
  it("같은 달이면 수신 연도", () => {
    expect(inferYear(9, new Date("2026-09-23T08:27:00+09:00"))).toBe(2026);
  });

  it("1월에 받은 12월 문자는 전년도", () => {
    expect(inferYear(12, new Date("2027-01-01T09:00:00+09:00"))).toBe(2026);
  });

  it("KST로는 새해지만 UTC로는 전년 12월 31일이어도 KST 기준", () => {
    // UTC 2026-12-31T15:12Z = KST 2027-01-01 00:12
    expect(inferYear(1, new Date("2027-01-01T00:12:00+09:00"))).toBe(2027);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm vitest run src/parsers/kst.test.ts`
Expected: FAIL — `Failed to resolve import "./kst"`

- [ ] **Step 4: 구현** — `src/parsers/kst.ts`

```ts
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 연·월 */
function kstYearMonth(d: Date): { year: number; month: number } {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1 };
}

/** KST 시각(월은 1부터)을 Date로 */
export function kstDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - KST_OFFSET_MS);
}

/** 연도 없는 문자의 연도: 문자 월이 수신 월(KST)보다 크면 전년도 */
export function inferYear(messageMonth: number, receivedAt: Date): number {
  const { year, month } = kstYearMonth(receivedAt);
  return messageMonth > month ? year - 1 : year;
}
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm vitest run src/parsers/kst.test.ts`
Expected: 4 passed

- [ ] **Step 6: 가상화한 픽스처** — `src/parsers/__fixtures__/kb-card.ts`

```ts
// 실제 국민카드 문자 형식을 따르되 카드번호·이름·금액·가맹점·누적액은 가상 값이다.

export const APPROVAL = `[Web발신]
KB국민카드1234승인
홍*동님
12,300원 일시불
09/23 08:26
테스트커피 강남역점(메가
누적1,234,567원`;

export const CANCEL = `[Web발신]
KB국민카드1234취소
홍*동님
12,300원 일시불
09/23 08:30
테스트커피 강남역점(메가
누적1,222,267원`;

export const APPROVAL_SMALL = `[Web발신]
KB국민카드1234승인
홍*동님
900원 일시불
09/29 19:58
지에스(GS)25 테스트점
누적1,223,167원`;

export const APPROVAL_INSTALLMENT = `[Web발신]
KB국민카드1234승인
홍*동님
360,000원 3개월
09/27 11:55
테스트가구 부천점
누적1,583,167원`;

export const TRANSIT_NOTICE = `[Web발신]
KB국민카드
후불교통(신용)
10건 45,600원
10/06 결제예정`;

export const UNKNOWN_KB = `[Web발신]
KB국민카드 10월 결제금액 안내
1,234,567원`;

export const NOT_KB = `[Web발신]
[테스트은행] 입금 50,000원`;
```

- [ ] **Step 7: 실패하는 분석기 테스트** — `src/parsers/kb-card.test.ts`

```ts
import { describe, expect, it } from "vitest";
import {
  APPROVAL, APPROVAL_INSTALLMENT, APPROVAL_SMALL, CANCEL, NOT_KB, TRANSIT_NOTICE, UNKNOWN_KB,
} from "./__fixtures__/kb-card";
import { kbCardParser } from "./kb-card";

const received = new Date("2026-09-23T08:27:00+09:00");

describe("kbCardParser.canParse", () => {
  it("국민카드 문자만 맡는다", () => {
    expect(kbCardParser.canParse(APPROVAL)).toBe(true);
    expect(kbCardParser.canParse(TRANSIT_NOTICE)).toBe(true);
    expect(kbCardParser.canParse(NOT_KB)).toBe(false);
  });
});

describe("kbCardParser.parse", () => {
  it("승인: 누적액이 아닌 결제 금액과 가맹점·일시를 뽑는다", () => {
    expect(kbCardParser.parse(APPROVAL, received)).toEqual({
      kind: "approval",
      amount: 12300,
      merchant: "테스트커피 강남역점(메가",
      occurredAt: new Date("2026-09-22T23:26:00.000Z"),
      issuer: "kb",
    });
  });

  it("취소는 양수 금액의 cancel", () => {
    const r = kbCardParser.parse(CANCEL, received);
    expect(r).toMatchObject({ kind: "cancel", amount: 12300, merchant: "테스트커피 강남역점(메가" });
  });

  it("쉼표 없는 소액", () => {
    expect(kbCardParser.parse(APPROVAL_SMALL, new Date("2026-09-30T00:00:00+09:00")))
      .toMatchObject({ kind: "approval", amount: 900, merchant: "지에스(GS)25 테스트점" });
  });

  it("할부 표기도 승인으로 해석한다", () => {
    expect(kbCardParser.parse(APPROVAL_INSTALLMENT, new Date("2026-09-30T00:00:00+09:00")))
      .toMatchObject({ kind: "approval", amount: 360000 });
  });

  it("후불교통 결제 예정 안내는 ignore", () => {
    expect(kbCardParser.parse(TRANSIT_NOTICE, received))
      .toEqual({ kind: "ignore", reason: "transit_billing_notice" });
  });

  it("형식을 모르는 국민카드 문자는 unknown", () => {
    expect(kbCardParser.parse(UNKNOWN_KB, received)).toEqual({ kind: "unknown" });
  });

  it("[Web발신] 없음·CRLF·줄 끝 공백이어도 같은 결과", () => {
    const altered = APPROVAL.replace("[Web발신]\n", "").replace(/\n/g, "  \r\n");
    expect(kbCardParser.parse(altered, received)).toEqual(kbCardParser.parse(APPROVAL, received));
  });

  it("1월에 받은 12월 31일 문자는 전년도 거래", () => {
    const dec = APPROVAL.replace("09/23 08:26", "12/31 23:50");
    const r = kbCardParser.parse(dec, new Date("2027-01-01T00:05:00+09:00"));
    expect(r).toMatchObject({ occurredAt: new Date("2026-12-31T14:50:00.000Z") });
  });
});
```

- [ ] **Step 8: 실패 확인**

Run: `pnpm vitest run src/parsers/kb-card.test.ts`
Expected: FAIL — `Failed to resolve import "./kb-card"`

- [ ] **Step 9: 구현** — `src/parsers/kb-card.ts`

```ts
import { inferYear, kstDate } from "./kst";
import type { CardSmsParser, ParseResult } from "./types";

// 승인·취소 문자 줄 구성:
// KB국민카드{끝4자리}{승인|취소} / {이름}님 / {금액}원 {일시불|N개월} / MM/DD HH:mm / {가맹점} / 누적{금액}원
const HEADER = /^KB국민카드\d{4}(승인|취소)$/;
const AMOUNT = /^([\d,]+)원\s+(?:일시불|\d+개월)$/;
const DATETIME = /^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/;

function lines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && l !== "[Web발신]");
}

export const kbCardParser: CardSmsParser = {
  id: "kb-card",

  canParse(body) {
    return lines(body)[0]?.startsWith("KB국민카드") ?? false;
  },

  parse(body, receivedAt): ParseResult {
    const ls = lines(body);

    if (ls[0] === "KB국민카드" && ls[1]?.startsWith("후불교통")) {
      return { kind: "ignore", reason: "transit_billing_notice" };
    }

    const header = HEADER.exec(ls[0] ?? "");
    const amount = AMOUNT.exec(ls[2] ?? "");
    const datetime = DATETIME.exec(ls[3] ?? "");
    const merchant = ls[4];
    if (!header || !amount || !datetime || !merchant || merchant.startsWith("누적")) {
      return { kind: "unknown" };
    }

    const [month, day, hour, minute] = datetime.slice(1).map(Number);
    return {
      kind: header[1] === "승인" ? "approval" : "cancel",
      amount: Number(amount[1].replaceAll(",", "")),
      merchant,
      occurredAt: kstDate(inferYear(month, receivedAt), month, day, hour, minute),
      issuer: "kb",
    };
  },
};
```

- [ ] **Step 10: 통과 확인**

Run: `pnpm vitest run src/parsers/kb-card.test.ts`
Expected: 9 passed

- [ ] **Step 11: 실패하는 목록 테스트** — `src/parsers/index.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { APPROVAL, NOT_KB } from "./__fixtures__/kb-card";
import { parseSms } from "./index";

const received = new Date("2026-09-23T08:27:00+09:00");

describe("parseSms", () => {
  it("맞는 분석기의 id와 결과를 돌려준다", () => {
    const { parserId, result } = parseSms(APPROVAL, received);
    expect(parserId).toBe("kb-card");
    expect(result.kind).toBe("approval");
  });

  it("맡을 분석기가 없으면 parserId null, unknown", () => {
    expect(parseSms(NOT_KB, received)).toEqual({ parserId: null, result: { kind: "unknown" } });
  });
});
```

- [ ] **Step 12: 실패 확인**

Run: `pnpm vitest run src/parsers/index.test.ts`
Expected: FAIL — `Failed to resolve import "./index"`

- [ ] **Step 13: 구현** — `src/parsers/index.ts`

```ts
import { kbCardParser } from "./kb-card";
import type { CardSmsParser, ParseResult } from "./types";

export type { CardSmsParser, ParseResult } from "./types";

// 카드사를 추가할 때는 분석기 파일과 픽스처 테스트를 만들고 여기에 등록한다.
export const PARSERS: readonly CardSmsParser[] = [kbCardParser];

export function parseSms(body: string, receivedAt: Date): { parserId: string | null; result: ParseResult } {
  const parser = PARSERS.find((p) => p.canParse(body));
  if (!parser) return { parserId: null, result: { kind: "unknown" } };
  return { parserId: parser.id, result: parser.parse(body, receivedAt) };
}
```

- [ ] **Step 14: 전체 단위 테스트**

Run: `pnpm test`
Expected: hash 3 + kst 4 + kb-card 9 + index 2 = 18 passed

- [ ] **Step 15: 사용자 승인 후 커밋**

```bash
git add src/parsers
git commit -m "feat: 국민카드 결제 문자 분석기 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 문자 저장·거래 생성 서비스

**Files:**
- Create: `src/ingest/mask.ts`, `src/ingest/mask.test.ts`, `src/ingest/auth.ts`, `src/ingest/service.ts`, `supabase/migrations/20261001000200_ingest.sql`, `tests/db/ingest-service.db.test.ts`

**Interfaces:**
- Consumes: `parseSms`(Task 4), `sha256Hex`(Task 1), 테스트 헬퍼(Task 3)
- Produces:
  - `maskBody(body: string): string`
  - `type TokenOwner = { userId: string; groupId: string }`
  - `resolveIngestToken(db: SupabaseClient, token: string, now: Date): Promise<TokenOwner | null>`
  - `type IngestSource = "ios_shortcut" | "android_macrodroid" | "manual_test"`
  - `type IngestStatus = "parsed" | "unparsed" | "ignored" | "duplicate"`
  - `type IngestResult = { status: IngestStatus; transactionId?: string }`
  - `ingestMessage(db: SupabaseClient, owner: TokenOwner, input: { body: string; receivedAt: Date; source: IngestSource }): Promise<IngestResult>`
  - SQL 함수 `public.find_cancel_target(p_group uuid, p_user uuid, p_amount bigint, p_merchant text, p_at timestamptz) returns uuid` (service_role 전용)

- [ ] **Step 1: 실패하는 마스킹 테스트** — `src/ingest/mask.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { maskBody } from "./mask";

describe("maskBody", () => {
  it("카드번호 끝자리를 가린다", () => {
    expect(maskBody(APPROVAL)).toContain("KB국민카드****승인");
    expect(maskBody(APPROVAL)).not.toContain("1234");
  });

  it("다른 내용은 그대로 둔다", () => {
    expect(maskBody(APPROVAL).replace("****", "1234")).toBe(APPROVAL);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/ingest/mask.test.ts`
Expected: FAIL — `Failed to resolve import "./mask"`

- [ ] **Step 3: 구현** — `src/ingest/mask.ts`

```ts
/** 저장 전에 원문의 카드번호 일부를 가린다. 분석은 마스킹 전 원문으로 한다. */
export function maskBody(body: string): string {
  return body.replace(/(카드)\d{4}/g, "$1****");
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/ingest/mask.test.ts`
Expected: 2 passed

- [ ] **Step 5: 취소 대상 찾기 함수** — `supabase/migrations/20261001000200_ingest.sql`

```sql
-- 취소 문자에 연결할 승인 거래: 같은 그룹·사용자·금액·가맹점, 취소 시각 이전 60일 안,
-- 아직 취소가 연결되지 않은 것 중 가장 최근 것
create function public.find_cancel_target(
  p_group uuid, p_user uuid, p_amount bigint, p_merchant text, p_at timestamptz
) returns uuid
language sql stable set search_path = public
as $$
  select t.id
  from public.transactions t
  where t.group_id = p_group
    and t.user_id = p_user
    and t.kind = 'approval'
    and t.amount = p_amount
    and t.merchant = p_merchant
    and t.occurred_at <= p_at
    and t.occurred_at > p_at - interval '60 days'
    and not exists (
      select 1 from public.transactions c where c.cancels_transaction_id = t.id
    )
  order by t.occurred_at desc
  limit 1
$$;

revoke execute on function public.find_cancel_target(uuid, uuid, bigint, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.find_cancel_target(uuid, uuid, bigint, text, timestamptz)
  to service_role;
```

```bash
supabase db reset
```

- [ ] **Step 6: 실패하는 서비스 통합 테스트** — `tests/db/ingest-service.db.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { APPROVAL, CANCEL, TRANSIT_NOTICE, UNKNOWN_KB } from "@/parsers/__fixtures__/kb-card";
import { resolveIngestToken } from "@/ingest/auth";
import { ingestMessage, type IngestSource } from "@/ingest/service";
import {
  adminClient, createGroupFixture, createLoneUser, issueIngestToken, type GroupFixture,
} from "../helpers/db";

const db = adminClient();
const source: IngestSource = "manual_test";
const received = new Date("2026-09-23T08:40:00+09:00");

/** 같은 형식에서 일시만 바꾼 문자 */
const at = (body: string, mmdd_hhmm: string) => body.replace(/\d{2}\/\d{2} \d{2}:\d{2}/, mmdd_hhmm);

async function txOf(groupId: string) {
  const { data, error } = await db
    .from("transactions")
    .select("id, kind, amount, merchant, occurred_at, cancels_transaction_id, category_id, user_id")
    .eq("group_id", groupId)
    .order("occurred_at");
  if (error) throw error;
  return data;
}

describe("resolveIngestToken", () => {
  let g: GroupFixture;
  beforeAll(async () => { g = await createGroupFixture("tok"); });

  it("유효한 토큰은 사용자·그룹을 돌려주고 마지막 사용 시각을 남긴다", async () => {
    const token = await issueIngestToken(g.member.userId);
    const now = new Date("2026-09-23T00:00:00Z");
    expect(await resolveIngestToken(db, token, now)).toEqual({ userId: g.member.userId, groupId: g.groupId });
    const { data } = await db.from("ingest_tokens").select("last_used_at").eq("user_id", g.member.userId).single();
    expect(new Date(data!.last_used_at).toISOString()).toBe(now.toISOString());
  });

  it("없는 토큰·폐기된 토큰·그룹 없는 사용자는 null", async () => {
    expect(await resolveIngestToken(db, "nope", new Date())).toBeNull();

    const revoked = await issueIngestToken(g.owner.userId);
    await db.from("ingest_tokens").update({ revoked_at: new Date().toISOString() }).eq("user_id", g.owner.userId);
    expect(await resolveIngestToken(db, revoked, new Date())).toBeNull();

    const lone = await createLoneUser("lone");
    expect(await resolveIngestToken(db, await issueIngestToken(lone.userId), new Date())).toBeNull();
  });
});

describe("ingestMessage", () => {
  it("승인 문자는 거래가 되고 원문은 마스킹해 저장한다", async () => {
    const g = await createGroupFixture("appr");
    const owner = { userId: g.owner.userId, groupId: g.groupId };

    const r = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source });
    expect(r.status).toBe("parsed");
    expect(r.transactionId).toBeTruthy();

    const [tx] = await txOf(g.groupId);
    expect(tx).toMatchObject({ kind: "approval", amount: 12300, merchant: "테스트커피 강남역점(메가", user_id: g.owner.userId });
    expect(new Date(tx.occurred_at).toISOString()).toBe("2026-09-22T23:26:00.000Z");

    const { data: raw } = await db.from("raw_messages").select("body, status, parser_id, source").eq("group_id", g.groupId).single();
    expect(raw).toMatchObject({ status: "parsed", parser_id: "kb-card", source });
    expect(raw!.body).not.toContain("1234");
  });

  it("같은 문자를 다시 받으면 duplicate이고 거래는 하나", async () => {
    const g = await createGroupFixture("dup");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source });
    const again = await ingestMessage(db, owner, { body: APPROVAL, receivedAt: received, source });
    expect(again).toEqual({ status: "duplicate" });
    expect(await txOf(g.groupId)).toHaveLength(1);
  });

  it("승인 → 취소 → 같은 금액 재승인: 취소는 첫 승인에만 연결되고 합계는 재승인 금액", async () => {
    const g = await createGroupFixture("cancel");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    await ingestMessage(db, owner, { body: at(APPROVAL, "09/23 08:26"), receivedAt: received, source });
    await ingestMessage(db, owner, { body: at(CANCEL, "09/23 08:27"), receivedAt: received, source });
    await ingestMessage(db, owner, { body: at(APPROVAL, "09/23 08:28"), receivedAt: received, source });

    const [first, cancel, second] = await txOf(g.groupId);
    expect(cancel).toMatchObject({ kind: "cancel", amount: -12300, cancels_transaction_id: first.id });
    expect(second.kind).toBe("approval");
    expect(first.amount + cancel.amount + second.amount).toBe(12300);
  });

  it("다른 사람의 승인에는 취소가 연결되지 않는다", async () => {
    const g = await createGroupFixture("cross");
    await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: APPROVAL, receivedAt: received, source });
    await ingestMessage(db, { userId: g.member.userId, groupId: g.groupId }, { body: CANCEL, receivedAt: received, source });
    const cancel = (await txOf(g.groupId)).find((t) => t.kind === "cancel")!;
    expect(cancel.cancels_transaction_id).toBeNull();
  });

  it("원 승인이 없는 취소는 음수 단독 거래", async () => {
    const g = await createGroupFixture("orphan");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: CANCEL, receivedAt: received, source });
    expect(r.status).toBe("parsed");
    const [tx] = await txOf(g.groupId);
    expect(tx).toMatchObject({ kind: "cancel", amount: -12300, cancels_transaction_id: null });
  });

  it("후불교통 안내는 ignored, 모르는 문자는 unparsed로 원문만 남는다", async () => {
    const g = await createGroupFixture("ign");
    const owner = { userId: g.owner.userId, groupId: g.groupId };
    expect(await ingestMessage(db, owner, { body: TRANSIT_NOTICE, receivedAt: received, source })).toEqual({ status: "ignored" });
    expect(await ingestMessage(db, owner, { body: UNKNOWN_KB, receivedAt: received, source })).toEqual({ status: "unparsed" });
    expect(await txOf(g.groupId)).toHaveLength(0);
    const { data } = await db.from("raw_messages").select("status").eq("group_id", g.groupId).order("status");
    expect(data!.map((r) => r.status)).toEqual(["ignored", "unparsed"]);
  });

  it("가맹점 규칙이 있으면 카테고리를 붙인다", async () => {
    const g = await createGroupFixture("rule");
    const { data: cafe } = await db.from("categories").select("id").is("group_id", null).eq("name", "카페").single();
    await db.from("merchant_rules").insert({ group_id: g.groupId, merchant_pattern: "테스트커피 강남역점(메가", category_id: cafe!.id });
    await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: APPROVAL, receivedAt: received, source });
    const [tx] = await txOf(g.groupId);
    expect(tx.category_id).toBe(cafe!.id);
  });
});
```

- [ ] **Step 7: 실패 확인**

Run: `pnpm vitest run tests/db/ingest-service.db.test.ts`
Expected: FAIL — `Failed to resolve import "@/ingest/auth"`

- [ ] **Step 8: 토큰 확인 구현** — `src/ingest/auth.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/hash";

export type TokenOwner = { userId: string; groupId: string };

/** 토큰 주인과 그룹을 찾는다. 없음·폐기·그룹 미소속이면 null. */
export async function resolveIngestToken(
  db: SupabaseClient,
  token: string,
  now: Date,
): Promise<TokenOwner | null> {
  const { data: row, error } = await db
    .from("ingest_tokens")
    .select("id, user_id")
    .eq("token_hash", sha256Hex(token))
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: member, error: memberError } = await db
    .from("group_members")
    .select("group_id")
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!member) return null;

  const { error: touchError } = await db
    .from("ingest_tokens")
    .update({ last_used_at: now.toISOString() })
    .eq("id", row.id);
  if (touchError) throw touchError;

  return { userId: row.user_id, groupId: member.group_id };
}
```

- [ ] **Step 9: 서비스 구현** — `src/ingest/service.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/hash";
import { parseSms, type ParseResult } from "@/parsers";
import type { TokenOwner } from "./auth";
import { maskBody } from "./mask";

export type IngestSource = "ios_shortcut" | "android_macrodroid" | "manual_test";
export type IngestStatus = "parsed" | "unparsed" | "ignored" | "duplicate";
export type IngestResult = { status: IngestStatus; transactionId?: string };

type Payment = Extract<ParseResult, { kind: "approval" | "cancel" }>;

const UNIQUE_VIOLATION = "23505";

export async function ingestMessage(
  db: SupabaseClient,
  owner: TokenOwner,
  input: { body: string; receivedAt: Date; source: IngestSource },
): Promise<IngestResult> {
  const { parserId, result } = parseSms(input.body, input.receivedAt);
  const status =
    result.kind === "approval" || result.kind === "cancel" ? "parsed"
    : result.kind === "ignore" ? "ignored"
    : "unparsed";

  const { data: raw, error } = await db
    .from("raw_messages")
    .insert({
      group_id: owner.groupId,
      user_id: owner.userId,
      body: maskBody(input.body),
      body_hash: sha256Hex(input.body),
      source: input.source,
      received_at: input.receivedAt.toISOString(),
      status,
      parser_id: parserId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: "duplicate" };
    throw error;
  }

  if (result.kind !== "approval" && result.kind !== "cancel") return { status };

  try {
    const transactionId = await createTransaction(db, owner, raw.id, result);
    return { status, transactionId };
  } catch (e) {
    // 거래 저장에 실패하면 미분류로 돌려 화면에서 다시 처리할 수 있게 한다.
    await db.from("raw_messages").update({ status: "unparsed" }).eq("id", raw.id);
    throw e;
  }
}

async function createTransaction(
  db: SupabaseClient,
  owner: TokenOwner,
  rawMessageId: string,
  payment: Payment,
): Promise<string> {
  const categoryId = await findCategory(db, owner.groupId, payment.merchant);
  const cancelsId = payment.kind === "cancel" ? await findCancelTarget(db, owner, payment) : null;

  const { data, error } = await db
    .from("transactions")
    .insert({
      group_id: owner.groupId,
      user_id: owner.userId,
      raw_message_id: rawMessageId,
      kind: payment.kind,
      amount: payment.kind === "cancel" ? -payment.amount : payment.amount,
      merchant: payment.merchant,
      occurred_at: payment.occurredAt.toISOString(),
      issuer: payment.issuer,
      category_id: categoryId,
      cancels_transaction_id: cancelsId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function findCategory(db: SupabaseClient, groupId: string, merchant: string): Promise<string | null> {
  const { data, error } = await db
    .from("merchant_rules")
    .select("category_id")
    .eq("group_id", groupId)
    .eq("merchant_pattern", merchant)
    .maybeSingle();
  if (error) throw error;
  return data?.category_id ?? null;
}

async function findCancelTarget(db: SupabaseClient, owner: TokenOwner, payment: Payment): Promise<string | null> {
  const { data, error } = await db.rpc("find_cancel_target", {
    p_group: owner.groupId,
    p_user: owner.userId,
    p_amount: payment.amount,
    p_merchant: payment.merchant,
    p_at: payment.occurredAt.toISOString(),
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}
```

- [ ] **Step 10: 통과 확인**

Run: `pnpm vitest run tests/db/ingest-service.db.test.ts && pnpm test`
Expected: ingest-service 9 passed, 단위 테스트 20 passed

- [ ] **Step 11: 사용자 승인 후 커밋**

```bash
git add src/ingest supabase/migrations tests
git commit -m "feat: 결제 문자 저장·중복 확인·취소 연결 서비스 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `POST /api/ingest` 라우트

**Files:**
- Create: `src/ingest/rate-limit.ts`, `src/ingest/rate-limit.test.ts`, `src/ingest/handler.ts`, `src/lib/supabase-admin.ts`, `src/app/api/ingest/route.ts`, `tests/db/ingest-api.db.test.ts`, `Dockerfile`, `.dockerignore`
- Modify: `README.md`

**Interfaces:**
- Consumes: `resolveIngestToken`, `ingestMessage`, `IngestSource`(Task 5)
- Produces:
  - `type RateLimiter = (key: string) => boolean` (허용이면 true)
  - `createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): RateLimiter`
  - `type IngestDeps = { db: SupabaseClient; limiter: RateLimiter; now: () => Date }`
  - `handleIngest(req: Request, deps: IngestDeps): Promise<Response>`
  - `createAdminClient(): SupabaseClient` (환경변수 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)

- [ ] **Step 1: 실패하는 요청 제한 테스트** — `src/ingest/rate-limit.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("창 안에서 limit까지 허용하고 넘으면 거부, 창이 지나면 다시 허용", () => {
    let t = 0;
    const allow = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t });
    expect([allow("a"), allow("a"), allow("a")]).toEqual([true, true, false]);
    expect(allow("b")).toBe(true);
    t = 60_000;
    expect(allow("a")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/ingest/rate-limit.test.ts`
Expected: FAIL — `Failed to resolve import "./rate-limit"`

- [ ] **Step 3: 구현** — `src/ingest/rate-limit.ts`

```ts
export type RateLimiter = (key: string) => boolean;

/** 키별 고정 창 요청 제한(단일 프로세스 메모리). */
export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();

  return (key) => {
    const t = now();
    const w = windows.get(key);
    if (!w || t - w.start >= opts.windowMs) {
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (w.count >= opts.limit) return false;
    w.count += 1;
    return true;
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/ingest/rate-limit.test.ts`
Expected: 1 passed

- [ ] **Step 5: 실패하는 API 통합 테스트** — `tests/db/ingest-api.db.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { handleIngest, type IngestDeps } from "@/ingest/handler";
import { createRateLimiter } from "@/ingest/rate-limit";
import { adminClient, createGroupFixture, issueIngestToken, type GroupFixture } from "../helpers/db";

const SERVER_NOW = new Date("2026-09-23T09:00:00+09:00");
const deps = (limit = 30): IngestDeps => ({
  db: adminClient(),
  limiter: createRateLimiter({ limit, windowMs: 60_000 }),
  now: () => SERVER_NOW,
});

function post(body: unknown, token?: string): Request {
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let g: GroupFixture;
let token: string;

beforeAll(async () => {
  g = await createGroupFixture("api");
  token = await issueIngestToken(g.owner.userId);
});

describe("POST /api/ingest", () => {
  it("정상 문자는 200 parsed", async () => {
    const res = await handleIngest(
      post({ body: APPROVAL, receivedAt: "2026-09-23T08:27:00+09:00", source: "ios_shortcut" }, token),
      deps(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "parsed" });
  });

  it("receivedAt이 없으면 서버 수신 시각으로 저장한다", async () => {
    const body = APPROVAL.replace("09/23 08:26", "09/23 08:50");
    const res = await handleIngest(post({ body, source: "android_macrodroid" }, token), deps());
    expect(res.status).toBe(200);
    const { data } = await adminClient()
      .from("raw_messages").select("received_at").eq("group_id", g.groupId).eq("source", "android_macrodroid").single();
    expect(new Date(data!.received_at).toISOString()).toBe(SERVER_NOW.toISOString());
  });

  it("토큰이 없거나 틀리면 401", async () => {
    const ok = { body: APPROVAL, source: "ios_shortcut" };
    expect((await handleIngest(post(ok), deps())).status).toBe(401);
    expect((await handleIngest(post(ok, "wrong-token"), deps())).status).toBe(401);
  });

  it("JSON이 아니거나 형식이 틀리면 400", async () => {
    expect((await handleIngest(post("not json", token), deps())).status).toBe(400);
    expect((await handleIngest(post({ body: "", source: "ios_shortcut" }, token), deps())).status).toBe(400);
    expect((await handleIngest(post({ body: APPROVAL, source: "pager" }, token), deps())).status).toBe(400);
    expect(
      (await handleIngest(post({ body: APPROVAL, source: "ios_shortcut", receivedAt: "어제" }, token), deps())).status,
    ).toBe(400);
  });

  it("토큰당 제한을 넘으면 429", async () => {
    const d = deps(2);
    const req = () => post({ body: `${APPROVAL}\n#${Math.random()}`, source: "manual_test" }, token);
    expect((await handleIngest(req(), d)).status).toBe(200);
    expect((await handleIngest(req(), d)).status).toBe(200);
    expect((await handleIngest(req(), d)).status).toBe(429);
  });
});
```

- [ ] **Step 6: 실패 확인**

Run: `pnpm vitest run tests/db/ingest-api.db.test.ts`
Expected: FAIL — `Failed to resolve import "@/ingest/handler"`

- [ ] **Step 7: 핸들러 구현** — `src/ingest/handler.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveIngestToken } from "./auth";
import type { RateLimiter } from "./rate-limit";
import { ingestMessage } from "./service";

const RequestBody = z.object({
  body: z.string().trim().min(1).max(2000),
  receivedAt: z.string().datetime({ offset: true }).optional(),
  source: z.enum(["ios_shortcut", "android_macrodroid", "manual_test"]),
});

export type IngestDeps = { db: SupabaseClient; limiter: RateLimiter; now: () => Date };

const json = (status: number, payload: unknown) => Response.json(payload, { status });

export async function handleIngest(req: Request, deps: IngestDeps): Promise<Response> {
  const token = /^Bearer\s+(\S+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!token) return json(401, { error: "unauthorized" });
  if (!deps.limiter(token)) return json(429, { error: "rate_limited" });

  const owner = await resolveIngestToken(deps.db, token, deps.now());
  if (!owner) return json(401, { error: "unauthorized" });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const parsed = RequestBody.safeParse(payload);
  if (!parsed.success) return json(400, { error: "invalid_body" });

  const { body, receivedAt, source } = parsed.data;
  const result = await ingestMessage(deps.db, owner, {
    body,
    receivedAt: receivedAt ? new Date(receivedAt) : deps.now(),
    source,
  });
  return json(200, result);
}
```

- [ ] **Step 8: 통과 확인**

Run: `pnpm vitest run tests/db/ingest-api.db.test.ts`
Expected: 5 passed

- [ ] **Step 9: 서버 클라이언트와 Next.js 라우트**

`src/lib/supabase-admin.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** service_role 클라이언트. 서버 코드(라우트·서버 액션)에서만 import한다. */
export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다");
  return createClient(url, key, { auth: { persistSession: false } });
}
```

`src/app/api/ingest/route.ts`:

```ts
import { handleIngest } from "@/ingest/handler";
import { createRateLimiter } from "@/ingest/rate-limit";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

export async function POST(req: Request): Promise<Response> {
  return handleIngest(req, { db: createAdminClient(), limiter, now: () => new Date() });
}
```

- [ ] **Step 10: 실제 서버로 수동 확인**

`.env.local`에 로컬 값을 넣는다(커밋 금지):

```bash
grep -E "^SUPABASE_(URL|SERVICE_ROLE_KEY)=" .env.test.local > .env.local
pnpm dev
```

다른 터미널에서 테스트 토큰을 발급하고 요청한다. 토큰 발급은 다음 한 줄 스크립트로 한다(그룹 소속 사용자가 필요하므로 DB 테스트를 한 번 실행한 뒤 아무 그룹원 id를 쓴다):

```bash
USER_ID=$(psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -Atc "select user_id from group_members limit 1")
TOKEN=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")
HASH=$(printf %s "$TOKEN" | shasum -a 256 | cut -d' ' -f1)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "insert into ingest_tokens (user_id, token_hash, label) values ('$USER_ID', '$HASH', 'curl')"
curl -s -X POST http://localhost:3000/api/ingest \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"body":"[Web발신]\nKB국민카드1234승인\n홍*동님\n4,500원 일시불\n10/01 12:00\n수동확인상점\n누적100,000원","source":"manual_test"}'
```
Expected: `{"status":"parsed","transactionId":"..."}`. 같은 명령을 한 번 더 실행하면 `{"status":"duplicate"}`.

`psql`이 없으면 `supabase db` 대신 Supabase Studio(`http://127.0.0.1:54323`)의 SQL Editor에서 같은 SQL을 실행한다.

- [ ] **Step 11: README에 ingest API 설명 추가**

`README.md` 끝에 추가:

````markdown
## 결제 문자 수신 API

```http
POST /api/ingest
Authorization: Bearer <기기 토큰>
Content-Type: application/json

{ "body": "<문자 원문>", "receivedAt": "<ISO 8601, 생략 시 서버 시각>", "source": "ios_shortcut" | "android_macrodroid" | "manual_test" }
```

| 응답 | 의미 |
|---|---|
| `200 {"status":"parsed","transactionId":...}` | 거래 저장 |
| `200 {"status":"ignored"}` | 결제가 아닌 안내 문자(후불교통 등) |
| `200 {"status":"unparsed"}` | 해석하지 못해 원문만 저장 |
| `200 {"status":"duplicate"}` | 이미 받은 문자 |
| `400` / `401` / `429` | 형식 오류 / 토큰 오류 / 분당 30회 초과 |
````

- [ ] **Step 12: NAS 배포 대비 Docker 이미지 확인**

NAS(DS920+)에 올릴 이미지 형태를 미리 검증한다. 이 Mac은 arm64, NAS는 amd64라서 여기서 만든 이미지는 동작 확인용이고, NAS용 amd64 빌드는 계획 4에서 GitHub Actions로 한다.

`.dockerignore`:

```gitignore
.git
node_modules
.next
coverage
.env*
supabase/.temp
supabase/.branches
tests
docs
```

`Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
```

비밀값은 이미지에 넣지 않고 실행할 때 환경변수로 준다. 컨테이너 안에서 `127.0.0.1`은 컨테이너 자신이므로 로컬 Supabase는 `host.docker.internal`로 접속한다.

```bash
docker build -t nof-payments-book:local .
docker run -d --name nof-check -p 3001:3000 \
  -e SUPABASE_URL=http://host.docker.internal:54321 \
  -e SUPABASE_SERVICE_ROLE_KEY="$(grep ^SUPABASE_SERVICE_ROLE_KEY= .env.test.local | cut -d= -f2-)" \
  nof-payments-book:local
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/api/ingest
curl -s -X POST http://localhost:3001/api/ingest \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"body":"[Web발신]\nKB국민카드1234승인\n홍*동님\n7,700원 일시불\n10/01 12:30\n도커확인상점\n누적100,000원","source":"manual_test"}'
docker rm -f nof-check
```
Expected: 첫 요청 `401`, 두 번째 요청 `{"status":"parsed",...}` (`$TOKEN`은 Step 10에서 발급한 값)

- [ ] **Step 13: 전체 검증**

```bash
pnpm lint && pnpm test && pnpm test:db && pnpm build && pnpm secrets:scan
```
Expected: 단위 21 passed, DB(schema 2 + rls 9 + ingest-service 9 + ingest-api 5) 25 passed, 빌드 성공, `no leaks found`

- [ ] **Step 14: 사용자 승인 후 커밋과 push**

```bash
git add src tests README.md Dockerfile .dockerignore
git commit -m "feat: POST /api/ingest 결제 문자 수신 API 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```
