# 인증·초대 (계획 2/4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초대받은 사람만 Google 계정으로 가입하고 이후 Google 로그인으로 들어오며, 운영자 → 그룹장 → 배우자 순서로 초대해 그룹을 만들고, 각자 기기 토큰을 발급받아 결제 문자를 보낼 수 있게 한다.

**Architecture:** 초대 수락·그룹 생성·초대/토큰 발급은 Postgres 함수(security definer, `auth.uid()` 기준)로 만들어 인원 제한과 권한을 DB에서 지킨다. Next.js 쪽은 `@supabase/ssr`로 쿠키 세션을 다루고, `src/proxy.ts`(Next 16의 미들웨어)가 세션 갱신과 비로그인 리다이렉트를 맡는다. 화면은 서버 컴포넌트 + 서버 액션으로 최소한만 만들고, 한 번만 보여 줄 비밀값(초대 링크·기기 토큰)은 URL에 남기지 않도록 `useActionState` 클라이언트 폼으로 표시한다. 디자인은 계획 3에서 다룬다.

**Tech Stack:** Next.js 16(App Router, `proxy.ts`, Server Actions, Route Handler), `@supabase/ssr` 0.12(PKCE), `server-only`, Supabase Auth(Google OAuth), Vitest, 로컬 Supabase

**Spec:** `docs/superpowers/specs/2026-10-01-nof-payments-book-design.md` (2장 사용자와 권한, 6장 화면 중 가입·그룹·운영자·내 기기 연결)

## Global Constraints

- 작업 원칙: **각 Task 시작 전과 모든 커밋 전에 사용자 승인**을 받는다. 설치·클라우드 변경도 승인 대상이다.
- 검증: 매 Task 끝에 `pnpm test`, `pnpm test:db`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm secrets:scan`을 모두 실행한다(계획 1 Task 3에서 빌드 검증 누락 사례).
- 공개 저장소: 실제 문자·이메일·사이트 주소·비밀값을 커밋하지 않는다. 비밀값은 `.env*`에만 둔다.
- 로그인: **Google 로그인만** 쓴다(비밀번호·이메일 로그인 없음). 초대 링크만 있으면 어느 Google 계정으로든 가입할 수 있다(1회용·7일 만료).
- Google 첫 로그인이 Supabase 인증 계정을 만들 수 있도록 Auth 가입은 켜 두되(`[auth] enable_signup = true`), 이메일 가입은 끈다(`[auth.email] enable_signup = false`). 앱 사용 권한은 **프로필**로 판단한다: 프로필은 초대 수락(`accept_invite`)이나 운영자 스크립트로만 생긴다. 프로필 없이 로그인하면 즉시 로그아웃시킨다.
- OAuth 이후 이동 경로(`next`)는 같은 사이트의 경로만 허용한다(오픈 리다이렉트 방지).
- Google OAuth 클라이언트 ID·비밀값은 `supabase/.env`(git 제외)에만 둔다.
- 인원 제한은 `app_settings`의 `max_users`(30), `max_group_members`(2), 초대 유효기간은 `invite_ttl_days`(7)를 읽는다. 하드코딩 금지.
- 초대·기기 토큰은 32바이트 무작위 값, DB에는 SHA-256 hex만 저장한다(`newSecret()`). 원문은 발급 화면에서 한 번만 보여 주고 URL·DB·로그에 남기지 않는다.
- `service_role` 키는 서버 전용 모듈(`import "server-only"`)에서만 쓴다.
- 새 DB 함수는 `public`·`anon`의 실행 권한을 회수하고 필요한 역할에만 준다.
- 개발 서버 포트는 **3100**(3000·3001은 다른 프로젝트가 사용 중).
- 클라우드 Supabase의 Google 로그인·이동 허용 주소 설정은 계획 4에서 한다. 계획 2는 로컬 Supabase + 실제 Google 계정으로 확인한다.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`를 붙인다.

## Review Focus

1. **마지막 한 자리를 두 사람이 동시에 수락**: 그룹(2명)·서비스(30명) 인원이 넘치지 않아야 한다. → Task 2 동시 수락 테스트
2. **초대 링크 재사용·만료·취소·위조**: 한 번 쓴 링크, 만료·취소된 링크, 없는 링크는 계정·소속을 만들지 않고 사유를 보여야 한다. → Task 2 테스트
3. **초대 없이 Google 로그인**: 프로필이 생기지 않고 즉시 로그아웃돼야 하며, 그 상태로 어떤 데이터도 읽을 수 없어야 한다. → Task 2 RLS 확인 테스트, Task 7 수동 확인
6. **로그인 후 이동 주소 조작**: `next`에 외부 주소(`//evil.com`, `https://…`)를 넣어도 사이트 밖으로 나가지 않아야 한다. → Task 1 `safeNextPath` 테스트
4. **이미 그룹이 있는 사람이 다른 그룹 초대를 수락**: 거부돼야 하고 기존 소속이 유지돼야 한다. → Task 2 테스트
5. **폐기한 기기 토큰**: 사용자가 되살릴 수 없고 ingest에서 401이어야 한다. → Task 2 테스트

## 계획 1에서 미룬 작은 문제 처리

| 계획 1 Minor | 처리 위치 |
|---|---|
| 폐기한 토큰을 다시 살릴 수 있음 | Task 2 (`revoke_ingest_token` 함수로만 폐기, 직접 update 권한 회수) |
| 새 테이블·함수가 anon에 기본 공개 | Task 2 (`alter default privileges`) |
| `server-only` 없음 | Task 1 |
| 있을 수 없는 날짜 미검사 | Task 3 |
| 수동 입력·예산·규칙의 ID 칸 그룹 미검사 | Task 3 |

취소가 승인보다 먼저 도착하는 경우의 연결과 스펙 문서의 `duplicate` 설명 수정은 계획 3에서 다룬다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `supabase/config.toml` | Google 로그인, 이메일 가입 끔, site_url·이동 허용 주소 |
| `supabase/.env` (git 제외) | Google OAuth 클라이언트 ID·비밀값 |
| `supabase/migrations/20261001000500_invites_groups.sql` | 초대·그룹·기기 토큰 함수, 권한 정리 |
| `supabase/migrations/20261001000600_rls_references.sql` | 카테고리·ID 칸 그룹 검사 |
| `src/lib/supabase-server.ts` | 쿠키 세션 Supabase 클라이언트 |
| `src/lib/session.ts` | `loadMe()`: 로그인 사용자·프로필·그룹 |
| `src/proxy.ts` | 세션 갱신, 비로그인 리다이렉트 |
| `src/auth/paths.ts` | 로그인 없이 열 수 있는 경로, 안전한 이동 경로 |
| `src/auth/display-name.ts` | Google 정보에서 기본 이름 |
| `src/app/auth/callback/route.ts` | Google 로그인 후 세션 교환 |
| `src/app/auth/no-profile/route.ts` | 프로필 없는 로그인 정리(로그아웃) |
| `src/auth/messages.ts` | 오류 코드 → 한국어 문구 |
| `src/auth/result.ts` | RPC 호출 결과 형식 |
| `src/auth/tokens.ts` | `newSecret()` |
| `src/auth/invites.ts` | 초대 상태 확인, 수락 |
| `src/auth/groups.ts` | 그룹 생성, 그룹·서비스 초대 발급·취소, 기기 토큰 발급·폐기 |
| `src/auth/operator.ts` | 운영자 지정 |
| `scripts/grant-operator.ts` | `pnpm operator:grant` |
| `src/components/one-time-secret-form.tsx` | 한 번만 보이는 값 표시 폼 |
| `src/app/login/*`, `src/app/invite/[token]/*` | 로그인·초대 수락 화면 |
| `src/app/page.tsx` | 홈(내 정보·이동 링크) |
| `src/app/group/*`, `src/app/operator/*`, `src/app/devices/*` | 그룹·운영자·내 기기 화면 |

---

### Task 1: 인증 기반 (세션 클라이언트·proxy·Google 로그인 설정)

**Files:**
- Modify: `supabase/config.toml`, `package.json`, `.env.example`, `scripts/write-test-env.sh`, `src/lib/supabase-admin.ts`
- Create: `supabase/.env`(git 제외), `src/lib/supabase-server.ts`, `src/auth/paths.ts`, `src/auth/paths.test.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`

**Interfaces:**
- Produces:
  - `createSupabaseServerClient(): Promise<SupabaseClient>` (서버 컴포넌트·서버 액션용, 쿠키 세션)
  - `isPublicPath(pathname: string): boolean`
  - `safeNextPath(next: string | null): string` (같은 사이트 경로만, 아니면 `/`)
  - 라우트 `GET /auth/callback?code=…&next=…`
  - 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `APP_URL`

- [ ] **Step 1: 승인 후 패키지 설치**

```bash
pnpm add @supabase/ssr server-only
```

- [ ] **Step 2: Google OAuth 클라이언트 준비 (사용자 작업)**

사용자가 Google Cloud Console(https://console.cloud.google.com)에서 직접 한다. 단계별로 안내하고 끝날 때까지 기다린다.

1. 프로젝트 만들기(예: `nof-payments-book`)
2. **Google 인증 플랫폼 → 브랜딩(OAuth 동의 화면)**: 앱 이름, 지원 이메일. 대상은 **외부**. 테스트 단계에서는 **테스트 사용자**에 가족 Gmail을 추가한다(테스트 단계에서는 등록된 계정만 로그인 가능).
3. **클라이언트 → 클라이언트 만들기**: 유형 **웹 애플리케이션**, 승인된 리디렉션 URI에 다음 두 개를 넣는다.
   - `http://127.0.0.1:54321/auth/v1/callback` (로컬 Supabase)
   - `https://jmswewolwpjutohayrcf.supabase.co/auth/v1/callback` (클라우드, 계획 4에서 사용)
4. 만들어진 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 대화창에 붙여넣지 말고, 사용자가 직접 `supabase/.env`에 저장한다:

```dotenv
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```

확인(값은 출력하지 않는다):

```bash
git check-ignore -q supabase/.env && echo ignored
grep -c "^SUPABASE_AUTH_EXTERNAL_GOOGLE_.*=.\+" supabase/.env
```
Expected: `ignored`, `2`

- [ ] **Step 2-1: 로컬 Auth 설정** — `supabase/config.toml`

다음 값을 바꾼다(각 키는 이미 파일에 있다):

```toml
[auth]
site_url = "http://127.0.0.1:3100"
additional_redirect_urls = ["http://127.0.0.1:3100/**"]
# Google 첫 로그인이 인증 계정을 만들 수 있어야 한다. 앱 사용 권한은 프로필(초대 수락)로 판단한다.
enable_signup = true

[auth.email]
# 이메일·비밀번호 가입과 로그인은 쓰지 않는다
enable_signup = false
```

`[auth.external.apple]` 블록 아래에 추가:

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
redirect_uri = ""
url = ""
skip_nonce_check = false
```

```bash
supabase stop && supabase start
```
Expected: 정상 기동. `supabase/.env` 값을 읽지 못하면 기동 로그에 Google 관련 경고가 나온다.

- [ ] **Step 3: 환경변수와 개발 포트**

`.env.example`에 추가:

```dotenv
# 초대 링크 등에 쓰는 앱 주소
APP_URL=http://127.0.0.1:3100
```

`scripts/write-test-env.sh`의 heredoc을 다음으로 바꿔 화면용 키도 기록한다:

```sh
cat > .env.test.local <<ENV
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
APP_URL=http://127.0.0.1:3100
ENV
```

```bash
./scripts/write-test-env.sh && cp .env.test.local .env.local
```

`package.json` scripts:

```json
"dev": "next dev --port 3100",
"test:db": "vitest run tests/db --no-file-parallelism"
```

`.env.local`에는 화면용 키와 `APP_URL`이 들어 있어야 한다(위 스크립트가 기록). `test:db`를 파일 단위 순차 실행으로 바꾸는 이유: Task 2의 서비스 인원 테스트가 `max_users`를 잠시 바꾸고 전체 프로필 수를 센다.

- [ ] **Step 4: 실패하는 경로 테스트** — `src/auth/paths.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isPublicPath, safeNextPath } from "./paths";

describe("isPublicPath", () => {
  it("로그인·초대 화면은 로그인 없이 연다", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/login/verify")).toBe(true);
    expect(isPublicPath("/invite/abc")).toBe(true);
    expect(isPublicPath("/invite/abc/verify")).toBe(true);
  });

  it("나머지는 로그인이 필요하다", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/devices")).toBe(false);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/invite")).toBe(false);
  });

  it("Google 로그인 콜백·정리 경로는 로그인 없이 연다", () => {
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/auth/no-profile")).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("같은 사이트 경로만 허용하고 나머지는 /", () => {
    expect(safeNextPath("/invite/abc")).toBe("/invite/abc");
    expect(safeNextPath("/group?x=1")).toBe("/group?x=1");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("invite")).toBe("/");
  });
});
```

- [ ] **Step 5: 실패 확인**

Run: `pnpm vitest run src/auth/paths.test.ts`
Expected: FAIL — `Cannot find module './paths'`

- [ ] **Step 6: 구현** — `src/auth/paths.ts`

```ts
/** 로그인 없이 열 수 있는 화면 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/auth/")
  );
}

/** 로그인 후 이동할 경로: 같은 사이트의 절대 경로만 허용한다(//host, /\host, 외부 URL 차단). */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
```

- [ ] **Step 7: 통과 확인**

Run: `pnpm vitest run src/auth/paths.test.ts`
Expected: 4 passed

- [ ] **Step 8: 세션 클라이언트** — `src/lib/supabase-server.ts`

```ts
import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** 로그인 사용자 권한(anon key + 쿠키 세션)의 클라이언트. RLS가 적용된다. */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없다. 세션 갱신은 proxy가 맡는다.
          }
        },
      },
    },
  );
}
```

`src/lib/supabase-admin.ts` 첫 줄에 추가(계획 1 Minor):

```ts
import "server-only";
```

- [ ] **Step 9: proxy** — `src/proxy.ts`

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/auth/paths";

/** 세션 쿠키를 갱신하고, 로그인하지 않은 사용자를 /login으로 보낸다(빠른 1차 확인). */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // 정적 파일과 기기 토큰으로 인증하는 /api/ingest는 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/ingest|.*\\.(?:svg|png|ico)$).*)"],
};
```

- [ ] **Step 9-1: Google 로그인 콜백** — `src/app/auth/callback/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Google 로그인 후 돌아와 PKCE 코드를 세션으로 바꾸고, 원래 가려던 경로로 보낸다. */
export async function GET(request: NextRequest) {
  const base = process.env.APP_URL!;
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, base));
  }
  return NextResponse.redirect(new URL("/login?error=login_failed", base));
}
```

- [ ] **Step 10: 빌드·동작 확인**

```bash
pnpm lint && npx tsc --noEmit && pnpm build
pnpm dev &
sleep 5
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:3100/
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3100/api/ingest
kill %1
```
Expected: 첫 줄 `307 http://127.0.0.1:3100/login`, 둘째 줄 `401`(ingest는 proxy 영향 없음)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:54321/auth/v1/authorize?provider=google"
```
Expected: `302`(Google 로그인 화면으로 이동). `400`이면 Google 설정이 읽히지 않은 것이다.

- [ ] **Step 11: 전체 검증 후 사용자 승인 받아 커밋**

```bash
pnpm test && pnpm test:db && pnpm secrets:scan
git add -A
git commit -m "feat: 쿠키 세션·proxy와 Google 로그인 설정

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: 단위 26 passed, DB 30 passed

---

### Task 2: 초대·그룹·기기 토큰 DB 함수

**Files:**
- Create: `supabase/migrations/20261001000500_invites_groups.sql`, `src/auth/messages.ts`, `src/auth/messages.test.ts`, `src/auth/result.ts`, `src/auth/tokens.ts`, `src/auth/invites.ts`, `src/auth/groups.ts`, `tests/db/invites.db.test.ts`
- Modify: `tests/helpers/db.ts`

**Interfaces:**
- Consumes: `sha256Hex`, `randomToken`(계획 1), `resolveIngestToken`(계획 1), 테스트 헬퍼
- Produces:
  - SQL(authenticated): `create_service_invite(p_token_hash text) returns timestamptz`, `create_group(p_name text) returns uuid`, `create_group_invite(p_token_hash text) returns timestamptz`, `revoke_group_invite(p_invite_id uuid) returns void`, `accept_invite(p_token_hash text, p_display_name text) returns jsonb {kind, group_id}`, `issue_ingest_token(p_token_hash text, p_label text) returns uuid`, `revoke_ingest_token(p_token_id uuid) returns void`
  - SQL(service_role): `invite_status(p_token_hash text) returns jsonb {status, kind?, group_name?}`
  - 오류 코드(예외 메시지): `not_authenticated`, `not_allowed`, `name_required`, `invite_invalid`, `invite_used`, `invite_expired`, `invite_revoked`, `service_full`, `group_full`, `already_in_group`, `not_in_group`
  - TS:
    - `errorMessage(code: string): string`, `rpcErrorCode(error: { message: string }): string | null`
    - `type Result<T> = { ok: true; value: T } | { ok: false; reason: string }`, `callRpc<T>(p, map): Promise<Result<T>>`
    - `newSecret(): { token: string; hash: string }`
    - `type InviteKind = "service" | "group"`, `type InviteStatus = { status: "valid"; kind: InviteKind; groupName: string | null } | { status: "invalid" | "used" | "expired" | "revoked" | "service_full" | "group_full" }`
    - `getInviteStatus(admin, token): Promise<InviteStatus>`, `inviteStatusError(status): string`, `acceptInvite(userDb, token, displayName): Promise<Result<{ kind: InviteKind; groupId: string | null }>>`
    - `createGroup(db, name): Promise<Result<string>>`, `createGroupInvite(db): Promise<Result<{ token: string; expiresAt: string }>>`, `revokeGroupInvite(db, inviteId): Promise<Result<null>>`, `createServiceInvite(db): Promise<Result<{ token: string; expiresAt: string }>>`, `issueIngestToken(db, label): Promise<Result<{ token: string; id: string }>>`, `revokeIngestToken(db, tokenId): Promise<Result<null>>`
    - 테스트 헬퍼 `createAuthOnlyUser(label): Promise<TestUser & { email: string }>`(프로필 없는 로그인 사용자), `makeOperator(userId): Promise<void>`

- [ ] **Step 1: 오류 문구 실패 테스트** — `src/auth/messages.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { errorMessage, rpcErrorCode } from "./messages";

describe("messages", () => {
  it("알려진 코드는 한국어 문구, 모르는 코드는 기본 문구", () => {
    expect(errorMessage("invite_expired")).toContain("만료");
    expect(errorMessage("???")).toBe("문제가 발생했습니다. 다시 시도해 주세요.");
  });

  it("DB 예외 메시지가 알려진 코드일 때만 코드로 인정", () => {
    expect(rpcErrorCode({ message: "group_full" })).toBe("group_full");
    expect(rpcErrorCode({ message: "duplicate key value" })).toBeNull();
  });

});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/auth/messages.test.ts`
Expected: FAIL — `Cannot find module './messages'`

- [ ] **Step 3: 구현** — `src/auth/messages.ts`

```ts
const MESSAGES: Record<string, string> = {
  not_authenticated: "로그인이 필요합니다.",
  not_allowed: "권한이 없습니다.",
  name_required: "이름을 입력해 주세요.",
  invite_invalid: "초대 링크가 올바르지 않습니다.",
  invite_used: "이미 사용된 초대 링크입니다.",
  invite_expired: "초대 링크가 만료되었습니다. 새 링크를 요청해 주세요.",
  invite_revoked: "취소된 초대 링크입니다.",
  service_full: "서비스 가입 인원이 가득 찼습니다.",
  group_full: "그룹 인원이 가득 찼습니다.",
  already_in_group: "이미 그룹에 속해 있습니다.",
  not_in_group: "먼저 그룹에 가입해야 합니다.",
  login_failed: "Google 로그인에 실패했습니다. 다시 시도해 주세요.",
  no_profile: "초대받은 링크로 가입을 마쳐 주세요. 초대 링크가 없다면 가족이나 운영자에게 요청하세요.",
};

const DB_ERROR_CODES = new Set([
  "not_authenticated", "not_allowed", "name_required", "invite_invalid", "invite_used",
  "invite_expired", "invite_revoked", "service_full", "group_full", "already_in_group", "not_in_group",
]);

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? "문제가 발생했습니다. 다시 시도해 주세요.";
}

/** DB 함수가 raise한 예외 메시지가 알려진 오류 코드면 그 코드를, 아니면 null */
export function rpcErrorCode(error: { message: string }): string | null {
  return DB_ERROR_CODES.has(error.message) ? error.message : null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/auth/messages.test.ts`
Expected: 2 passed

- [ ] **Step 5: 공통 결과·토큰 모듈**

`src/auth/result.ts`:

```ts
import { rpcErrorCode } from "./messages";

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

/** RPC를 호출해 알려진 오류 코드는 Result로, 그 밖의 오류는 예외로 돌려준다. */
export async function callRpc<T>(
  p: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  map: (data: unknown) => T,
): Promise<Result<T>> {
  const { data, error } = await p;
  if (error) {
    const code = rpcErrorCode(error);
    if (code) return { ok: false, reason: code };
    throw error;
  }
  return { ok: true, value: map(data) };
}
```

`src/auth/tokens.ts`:

```ts
import { randomToken, sha256Hex } from "@/lib/hash";

/** 한 번만 보여 줄 비밀값과 DB에 저장할 해시 */
export function newSecret(): { token: string; hash: string } {
  const token = randomToken();
  return { token, hash: sha256Hex(token) };
}
```

- [ ] **Step 6: 테스트 헬퍼 추가** — `tests/helpers/db.ts` 끝에 추가

```ts
/** 프로필 없이 로그인만 된 사용자(초대 수락 전 상태) */
export async function createAuthOnlyUser(label: string): Promise<TestUser & { email: string }> {
  const admin = adminClient();
  const email = `${label}-${randomUUID()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { userId: data.user.id, client, email };
}

export async function makeOperator(userId: string): Promise<void> {
  await must(
    adminClient().from("profiles").update({ is_operator: true, can_create_group: true }).eq("user_id", userId),
  );
}
```

- [ ] **Step 7: 실패하는 DB 테스트** — `tests/db/invites.db.test.ts`

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { resolveIngestToken } from "@/ingest/auth";
import {
  createGroup, createGroupInvite, createServiceInvite, issueIngestToken, revokeGroupInvite, revokeIngestToken,
} from "@/auth/groups";
import { acceptInvite, getInviteStatus } from "@/auth/invites";
import { sha256Hex } from "@/lib/hash";
import {
  adminClient, createAuthOnlyUser, createGroupFixture, createLoneUser, makeOperator, type TestUser,
} from "../helpers/db";

const admin = adminClient();

function expectOk<T>(r: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.value;
}

let operator: TestUser;

beforeAll(async () => {
  operator = await createLoneUser("operator");
  await makeOperator(operator.userId);
});

/** 서비스 초대로 가입해 그룹 생성 권한을 가진 사용자 */
async function serviceMember(label: string) {
  const user = await createAuthOnlyUser(label);
  const { token } = expectOk(await createServiceInvite(operator.client));
  expectOk(await acceptInvite(user.client, token, label));
  return user;
}

/** 그룹장 1명만 있는 그룹 */
async function ownerWithGroup(label: string) {
  const owner = await serviceMember(label);
  const groupId = expectOk(await createGroup(owner.client, `${label} 가계부`));
  return { owner, groupId };
}

describe("서비스 초대", () => {
  it("운영자만 발급할 수 있다", async () => {
    const normal = await createLoneUser("normal");
    expect(await createServiceInvite(normal.client)).toEqual({ ok: false, reason: "not_allowed" });
    const { token, expiresAt } = expectOk(await createServiceInvite(operator.client));
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("수락하면 프로필이 생기고 그룹 생성 권한을 받는다. 재사용은 거부", async () => {
    const user = await createAuthOnlyUser("svc");
    const { token } = expectOk(await createServiceInvite(operator.client));
    expect(await getInviteStatus(admin, token)).toEqual({ status: "valid", kind: "service", groupName: null });

    expect(await acceptInvite(user.client, token, "  새사람 ")).toEqual({ ok: true, value: { kind: "service", groupId: null } });
    const { data } = await admin.from("profiles").select("display_name, can_create_group").eq("user_id", user.userId).single();
    expect(data).toEqual({ display_name: "새사람", can_create_group: true });

    const other = await createAuthOnlyUser("svc2");
    expect(await acceptInvite(other.client, token, "다른사람")).toEqual({ ok: false, reason: "invite_used" });
    expect(await getInviteStatus(admin, token)).toEqual({ status: "used" });
  });

  it("만료·위조 링크와 빈 이름은 거부되고 프로필이 생기지 않는다", async () => {
    const user = await createAuthOnlyUser("bad");
    const { token } = expectOk(await createServiceInvite(operator.client));
    expect(await acceptInvite(user.client, token, "   ")).toEqual({ ok: false, reason: "name_required" });

    await admin.from("service_invites").update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("token_hash", sha256Hex(token));
    expect(await acceptInvite(user.client, token, "만료")).toEqual({ ok: false, reason: "invite_expired" });
    expect(await acceptInvite(user.client, "forged-token", "위조")).toEqual({ ok: false, reason: "invite_invalid" });
    expect(await getInviteStatus(admin, "forged-token")).toEqual({ status: "invalid" });

    const { data } = await admin.from("profiles").select("user_id").eq("user_id", user.userId);
    expect(data).toEqual([]);
  });

  it("서비스 인원이 가득 차면 새 사람은 가입할 수 없다", async () => {
    const { token } = expectOk(await createServiceInvite(operator.client));
    const user = await createAuthOnlyUser("full");
    const { count } = await admin.from("profiles").select("*", { count: "exact", head: true });
    await admin.from("app_settings").update({ value: count }).eq("key", "max_users");
    try {
      expect(await getInviteStatus(admin, token)).toEqual({ status: "service_full" });
      expect(await acceptInvite(user.client, token, "초과")).toEqual({ ok: false, reason: "service_full" });
    } finally {
      await admin.from("app_settings").update({ value: 30 }).eq("key", "max_users");
    }
  });
});

describe("그룹", () => {
  it("그룹 생성 권한이 있는 사람만, 한 번만 만든다", async () => {
    const owner = await serviceMember("maker");
    const groupId = expectOk(await createGroup(owner.client, "우리집"));
    const { data } = await admin.from("group_members").select("group_id, role").eq("user_id", owner.userId).single();
    expect(data).toEqual({ group_id: groupId, role: "owner" });
    expect(await createGroup(owner.client, "또")).toEqual({ ok: false, reason: "already_in_group" });

    const noPerm = await createLoneUser("noperm");
    expect(await createGroup(noPerm.client, "몰래")).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("그룹 초대는 그룹장만 발급하고, 수락하면 그룹원이 된다", async () => {
    const { owner, groupId } = await ownerWithGroup("ginv");
    const { token } = expectOk(await createGroupInvite(owner.client));
    expect(await getInviteStatus(admin, token)).toEqual({ status: "valid", kind: "group", groupName: "ginv 가계부" });

    const spouse = await createAuthOnlyUser("spouse");
    expect(await acceptInvite(spouse.client, token, "배우자")).toEqual({ ok: true, value: { kind: "group", groupId } });
    expect(await createGroupInvite(spouse.client)).toEqual({ ok: false, reason: "not_allowed" });
  });

  it("2명이 찬 그룹에는 더 들어갈 수 없다", async () => {
    const g = await createGroupFixture("full2");
    const { data: inv } = await admin.from("group_invites").insert({
      group_id: g.groupId, token_hash: sha256Hex("full2-token"), created_by: g.owner.userId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }).select("id").single();
    expect(inv).toBeTruthy();
    const third = await createAuthOnlyUser("third");
    expect(await acceptInvite(third.client, "full2-token", "셋째")).toEqual({ ok: false, reason: "group_full" });
  });

  it("마지막 한 자리를 두 사람이 동시에 수락하면 한 명만 들어간다", async () => {
    const { owner, groupId } = await ownerWithGroup("race");
    const a = expectOk(await createGroupInvite(owner.client)).token;
    const b = expectOk(await createGroupInvite(owner.client)).token;
    const [u1, u2] = await Promise.all([createAuthOnlyUser("race1"), createAuthOnlyUser("race2")]);

    const results = await Promise.all([acceptInvite(u1.client, a, "하나"), acceptInvite(u2.client, b, "둘")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, reason: "group_full" });
    const { count } = await admin.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", groupId);
    expect(count).toBe(2);
  });

  it("이미 그룹이 있는 사람은 다른 그룹 초대를 수락할 수 없고 기존 소속이 유지된다", async () => {
    const { owner } = await ownerWithGroup("other");
    const { token } = expectOk(await createGroupInvite(owner.client));
    const g = await createGroupFixture("mine");
    expect(await acceptInvite(g.member.client, token, "이동")).toEqual({ ok: false, reason: "already_in_group" });
    const { data } = await admin.from("group_members").select("group_id").eq("user_id", g.member.userId).single();
    expect(data!.group_id).toBe(g.groupId);
  });

  it("취소한 그룹 초대는 수락할 수 없다", async () => {
    const { owner } = await ownerWithGroup("revoke");
    const { token } = expectOk(await createGroupInvite(owner.client));
    const { data: inv } = await admin.from("group_invites").select("id").eq("token_hash", sha256Hex(token)).single();
    expectOk(await revokeGroupInvite(owner.client, inv!.id));
    const user = await createAuthOnlyUser("late");
    expect(await acceptInvite(user.client, token, "늦음")).toEqual({ ok: false, reason: "invite_revoked" });
  });

  it("그룹장은 자기 그룹 초대 목록을 보지만 토큰 해시는 볼 수 없다", async () => {
    const { owner } = await ownerWithGroup("list");
    expectOk(await createGroupInvite(owner.client));
    const visible = await owner.client.from("group_invites").select("id, expires_at, used_at, revoked_at");
    expect(visible.data).toHaveLength(1);
    const hidden = await owner.client.from("group_invites").select("token_hash");
    expect(hidden.error).not.toBeNull();
  });
});

describe("초대 없이 로그인한 사용자", () => {
  it("프로필이 없으면 어떤 그룹 데이터도 읽거나 만들 수 없다", async () => {
    const stranger = await createAuthOnlyUser("stranger");
    const g = await createGroupFixture("strangertarget");
    await admin.from("transactions").insert({
      group_id: g.groupId, user_id: g.owner.userId, kind: "manual", amount: 1,
      merchant: "비밀", occurred_at: new Date().toISOString(),
    });
    const tx = await stranger.client.from("transactions").select("id");
    expect(tx.data).toEqual([]);
    expect(await createGroup(stranger.client, "몰래")).toEqual({ ok: false, reason: "not_allowed" });
    expect(await issueIngestToken(stranger.client, "x")).toEqual({ ok: false, reason: "not_in_group" });
  });
});

describe("기기 토큰", () => {
  it("그룹원만 발급하고, 발급한 토큰으로 ingest 인증이 된다", async () => {
    const g = await createGroupFixture("dev");
    const { token, id } = expectOk(await issueIngestToken(g.member.client, "내 아이폰"));
    expect(id).toBeTruthy();
    expect(await resolveIngestToken(admin, token, new Date())).toEqual({ userId: g.member.userId, groupId: g.groupId });

    const lone = await createLoneUser("devlone");
    expect(await issueIngestToken(lone.client, "x")).toEqual({ ok: false, reason: "not_in_group" });
  });

  it("폐기하면 ingest가 거부되고, 사용자가 직접 되살릴 수 없다", async () => {
    const g = await createGroupFixture("rev");
    const { token, id } = expectOk(await issueIngestToken(g.owner.client, "갤럭시"));
    expectOk(await revokeIngestToken(g.owner.client, id));
    expect(await resolveIngestToken(admin, token, new Date())).toBeNull();

    const undo = await g.owner.client.from("ingest_tokens").update({ revoked_at: null }).eq("id", id);
    expect(undo.error).not.toBeNull();
    expect(await resolveIngestToken(admin, token, new Date())).toBeNull();
  });

  it("다른 사람의 토큰은 폐기할 수 없다", async () => {
    const g = await createGroupFixture("revother");
    const { token, id } = expectOk(await issueIngestToken(g.owner.client, "남의것"));
    expectOk(await revokeIngestToken(g.member.client, id));
    expect(await resolveIngestToken(admin, token, new Date())).not.toBeNull();
  });
});
```

- [ ] **Step 8: 실패 확인**

Run: `pnpm vitest run tests/db/invites.db.test.ts`
Expected: FAIL — `Cannot find package '@/auth/groups'`

- [ ] **Step 9: DB 함수** — `supabase/migrations/20261001000500_invites_groups.sql`

```sql
-- 이후 만드는 테이블·함수는 anon에 자동으로 열리지 않게 한다 (계획 1 Minor)
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- 정수 설정값
create function public.setting_int(p_key text) returns int
language sql stable set search_path = public
as $$
  select (value #>> '{}')::int from public.app_settings where key = p_key
$$;
revoke execute on function public.setting_int(text) from public, anon;

-- 서비스 초대 발급 (운영자)
create function public.create_service_invite(p_token_hash text) returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_expires timestamptz := now() + make_interval(days => public.setting_int('invite_ttl_days'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_operator) then
    raise exception 'not_allowed';
  end if;
  insert into public.service_invites (token_hash, created_by, expires_at)
  values (p_token_hash, auth.uid(), v_expires);
  return v_expires;
end
$$;

-- 그룹 생성 (그룹 생성 권한이 있고 아직 그룹이 없는 사람)
create function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and can_create_group) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from public.group_members where user_id = auth.uid()) then
    raise exception 'already_in_group';
  end if;
  insert into public.groups (name, owner_id) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end
$$;

-- 그룹 초대 발급·취소 (그룹장)
create function public.create_group_invite(p_token_hash text) returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_expires timestamptz := now() + make_interval(days => public.setting_int('invite_ttl_days'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select group_id into v_group from public.group_members where user_id = auth.uid() and role = 'owner';
  if v_group is null then raise exception 'not_allowed'; end if;
  insert into public.group_invites (group_id, token_hash, created_by, expires_at)
  values (v_group, p_token_hash, auth.uid(), v_expires);
  return v_expires;
end
$$;

create function public.revoke_group_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.group_invites i
  set revoked_at = now()
  where i.id = p_invite_id
    and i.used_at is null
    and i.revoked_at is null
    and i.group_id in (
      select group_id from public.group_members where user_id = auth.uid() and role = 'owner'
    );
end
$$;

-- 초대 상태 (가입 전 확인용, 서버 전용)
create function public.invite_status(p_token_hash text) returns jsonb
language plpgsql stable set search_path = public
as $$
declare
  s public.service_invites;
  g public.group_invites;
  v_users_full boolean := (select count(*) from public.profiles) >= public.setting_int('max_users');
begin
  select * into s from public.service_invites where token_hash = p_token_hash;
  if found then
    if s.used_at is not null then return jsonb_build_object('status', 'used'); end if;
    if s.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
    if v_users_full then return jsonb_build_object('status', 'service_full'); end if;
    return jsonb_build_object('status', 'valid', 'kind', 'service');
  end if;

  select * into g from public.group_invites where token_hash = p_token_hash;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if g.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if g.used_at is not null then return jsonb_build_object('status', 'used'); end if;
  if g.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if (select count(*) from public.group_members where group_id = g.group_id)
     >= public.setting_int('max_group_members') then
    return jsonb_build_object('status', 'group_full');
  end if;
  if v_users_full then return jsonb_build_object('status', 'service_full'); end if;
  return jsonb_build_object(
    'status', 'valid', 'kind', 'group',
    'group_name', (select name from public.groups where id = g.group_id)
  );
end
$$;

-- 초대 수락: 프로필 생성·권한 부여·그룹 가입을 한 번에. 인원 제한이 동시 수락에도 지켜지도록 직렬화한다.
create function public.accept_invite(p_token_hash text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_display_name, ''));
  v_has_profile boolean;
  s public.service_invites;
  g public.group_invites;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if v_name = '' then raise exception 'name_required'; end if;

  perform pg_advisory_xact_lock(hashtextextended('accept_invite', 0));
  v_has_profile := exists (select 1 from public.profiles where user_id = v_user);

  select * into s from public.service_invites where token_hash = p_token_hash for update;
  if found then
    if s.used_at is not null then raise exception 'invite_used'; end if;
    if s.expires_at <= now() then raise exception 'invite_expired'; end if;
    if v_has_profile then
      update public.profiles set can_create_group = true where user_id = v_user;
    else
      if (select count(*) from public.profiles) >= public.setting_int('max_users') then
        raise exception 'service_full';
      end if;
      insert into public.profiles (user_id, display_name, can_create_group) values (v_user, v_name, true);
    end if;
    update public.service_invites set used_by = v_user, used_at = now() where id = s.id;
    return jsonb_build_object('kind', 'service', 'group_id', null);
  end if;

  select * into g from public.group_invites where token_hash = p_token_hash for update;
  if not found then raise exception 'invite_invalid'; end if;
  if g.revoked_at is not null then raise exception 'invite_revoked'; end if;
  if g.used_at is not null then raise exception 'invite_used'; end if;
  if g.expires_at <= now() then raise exception 'invite_expired'; end if;
  if exists (select 1 from public.group_members where user_id = v_user) then
    raise exception 'already_in_group';
  end if;
  if (select count(*) from public.group_members where group_id = g.group_id)
     >= public.setting_int('max_group_members') then
    raise exception 'group_full';
  end if;
  if not v_has_profile then
    if (select count(*) from public.profiles) >= public.setting_int('max_users') then
      raise exception 'service_full';
    end if;
    insert into public.profiles (user_id, display_name) values (v_user, v_name);
  end if;
  insert into public.group_members (group_id, user_id, role) values (g.group_id, v_user, 'member');
  update public.group_invites set used_by = v_user, used_at = now() where id = g.id;
  return jsonb_build_object('kind', 'group', 'group_id', g.group_id);
end
$$;

-- 기기 토큰 발급·폐기 (폐기는 이 함수로만: 사용자가 되살릴 수 없다)
create function public.issue_ingest_token(p_token_hash text, p_label text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.group_members where user_id = auth.uid()) then
    raise exception 'not_in_group';
  end if;
  insert into public.ingest_tokens (user_id, token_hash, label)
  values (auth.uid(), p_token_hash, trim(coalesce(p_label, '')))
  returning id into v_id;
  return v_id;
end
$$;

create function public.revoke_ingest_token(p_token_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.ingest_tokens set revoked_at = now()
  where id = p_token_id and user_id = auth.uid() and revoked_at is null;
end
$$;

revoke update on public.ingest_tokens from authenticated;

-- 그룹장은 자기 그룹 초대 목록을 본다 (토큰 해시 제외)
create policy group_invites_read_owner on public.group_invites
  for select to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'owner'));
grant select (id, group_id, expires_at, used_at, revoked_at, created_at) on public.group_invites to authenticated;

-- 실행 권한
revoke execute on function
  public.create_service_invite(text), public.create_group(text), public.create_group_invite(text),
  public.revoke_group_invite(uuid), public.accept_invite(text, text),
  public.issue_ingest_token(text, text), public.revoke_ingest_token(uuid),
  public.invite_status(text)
from public, anon;
grant execute on function
  public.create_service_invite(text), public.create_group(text), public.create_group_invite(text),
  public.revoke_group_invite(uuid), public.accept_invite(text, text),
  public.issue_ingest_token(text, text), public.revoke_ingest_token(uuid)
to authenticated;
grant execute on function public.invite_status(text) to service_role;
```

```bash
supabase db reset
```

- [ ] **Step 10: TS 모듈** — `src/auth/invites.ts`

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/lib/hash";
import { callRpc, type Result } from "./result";

export type InviteKind = "service" | "group";
export type InviteStatus =
  | { status: "valid"; kind: InviteKind; groupName: string | null }
  | { status: "invalid" | "used" | "expired" | "revoked" | "service_full" | "group_full" };

export async function getInviteStatus(admin: SupabaseClient, token: string): Promise<InviteStatus> {
  const { data, error } = await admin.rpc("invite_status", { p_token_hash: sha256Hex(token) });
  if (error) throw error;
  const row = data as { status: InviteStatus["status"]; kind?: InviteKind; group_name?: string | null };
  if (row.status === "valid") return { status: "valid", kind: row.kind!, groupName: row.group_name ?? null };
  return { status: row.status };
}

/** 초대 상태 → 화면 오류 코드 */
export function inviteStatusError(status: Exclude<InviteStatus["status"], "valid">): string {
  return status === "service_full" || status === "group_full" ? status : `invite_${status}`;
}

/** 로그인한 사용자가 초대를 수락한다. */
export async function acceptInvite(
  userDb: SupabaseClient,
  token: string,
  displayName: string,
): Promise<Result<{ kind: InviteKind; groupId: string | null }>> {
  return callRpc(
    userDb.rpc("accept_invite", { p_token_hash: sha256Hex(token), p_display_name: displayName }),
    (data) => {
      const row = data as { kind: InviteKind; group_id: string | null };
      return { kind: row.kind, groupId: row.group_id };
    },
  );
}
```

`src/auth/groups.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { callRpc, type Result } from "./result";
import { newSecret } from "./tokens";

export async function createGroup(db: SupabaseClient, name: string): Promise<Result<string>> {
  return callRpc(db.rpc("create_group", { p_name: name }), (d) => d as string);
}

export async function createGroupInvite(db: SupabaseClient): Promise<Result<{ token: string; expiresAt: string }>> {
  const { token, hash } = newSecret();
  return callRpc(db.rpc("create_group_invite", { p_token_hash: hash }), (d) => ({ token, expiresAt: d as string }));
}

export async function revokeGroupInvite(db: SupabaseClient, inviteId: string): Promise<Result<null>> {
  return callRpc(db.rpc("revoke_group_invite", { p_invite_id: inviteId }), () => null);
}

export async function createServiceInvite(db: SupabaseClient): Promise<Result<{ token: string; expiresAt: string }>> {
  const { token, hash } = newSecret();
  return callRpc(db.rpc("create_service_invite", { p_token_hash: hash }), (d) => ({ token, expiresAt: d as string }));
}

export async function issueIngestToken(db: SupabaseClient, label: string): Promise<Result<{ token: string; id: string }>> {
  const { token, hash } = newSecret();
  return callRpc(db.rpc("issue_ingest_token", { p_token_hash: hash, p_label: label }), (d) => ({ token, id: d as string }));
}

export async function revokeIngestToken(db: SupabaseClient, tokenId: string): Promise<Result<null>> {
  return callRpc(db.rpc("revoke_ingest_token", { p_token_id: tokenId }), () => null);
}
```

- [ ] **Step 11: 통과 확인**

Run: `pnpm vitest run tests/db/invites.db.test.ts`
Expected: 15 passed

- [ ] **Step 12: 전체 검증 후 사용자 승인 받아 커밋**

```bash
pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan
git add supabase/migrations src/auth tests
git commit -m "feat: 초대 수락·그룹 생성·기기 토큰 발급 DB 함수 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: 단위 28 passed, DB 45 passed(계획 1의 30 + 15)

---

### Task 3: 계획 1 보완 (날짜 범위·ID 칸 그룹 검사)

**Files:**
- Modify: `src/parsers/kst.ts`, `src/parsers/kst.test.ts`, `src/parsers/kb-card.ts`, `src/parsers/kb-card.test.ts`, `tests/db/rls.db.test.ts`
- Create: `supabase/migrations/20261001000600_rls_references.sql`

**Interfaces:**
- Produces: `isValidKstDateTime(year, month, day, hour, minute): boolean`

- [ ] **Step 1: 실패하는 테스트**

`src/parsers/kst.test.ts` 끝에 추가:

```ts
describe("isValidKstDateTime", () => {
  it("있는 날짜·시각만 참", () => {
    expect(isValidKstDateTime(2026, 9, 23, 8, 26)).toBe(true);
    expect(isValidKstDateTime(2028, 2, 29, 0, 0)).toBe(true);
    expect(isValidKstDateTime(2026, 2, 30, 10, 0)).toBe(false);
    expect(isValidKstDateTime(2026, 13, 1, 10, 0)).toBe(false);
    expect(isValidKstDateTime(2026, 9, 23, 24, 0)).toBe(false);
    expect(isValidKstDateTime(2026, 9, 23, 8, 60)).toBe(false);
  });
});
```

그리고 첫 줄 import를 `import { inferYear, isValidKstDateTime, kstDate } from "./kst";`로 바꾼다.

`src/parsers/kb-card.test.ts`의 `describe("kbCardParser.parse"` 블록 끝에 추가:

```ts
  it("있을 수 없는 날짜·시각은 unknown", () => {
    expect(kbCardParser.parse(APPROVAL.replace("09/23 08:26", "13/45 99:99"), received)).toEqual({ kind: "unknown" });
    expect(kbCardParser.parse(APPROVAL.replace("09/23 08:26", "02/30 10:00"), received)).toEqual({ kind: "unknown" });
  });
```

`tests/db/rls.db.test.ts`의 `describe("그룹 격리 RLS"` 블록 끝에 추가:

```ts
  it("수동 입력·규칙·예산에 다른 그룹 카테고리를 붙일 수 없다", async () => {
    const tx = await a.owner.client.from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "manual", amount: 1,
      merchant: "남의카테고리", occurred_at: new Date().toISOString(), category_id: bCategoryId,
    });
    expect(tx.error).not.toBeNull();
    const rule = await a.owner.client.from("merchant_rules").insert({
      group_id: a.groupId, merchant_pattern: "x", category_id: bCategoryId,
    });
    expect(rule.error).not.toBeNull();
    const budget = await a.owner.client.from("budgets").insert({
      group_id: a.groupId, category_id: bCategoryId, month: "2026-10-01", amount: 1000,
    });
    expect(budget.error).not.toBeNull();
  });

  it("수동 입력에 취소 연결·원문 연결 칸을 직접 넣을 수 없다", async () => {
    const { error } = await a.owner.client.from("transactions").insert({
      group_id: a.groupId, user_id: a.owner.userId, kind: "manual", amount: 1,
      merchant: "연결위조", occurred_at: new Date().toISOString(),
      cancels_transaction_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test; pnpm vitest run tests/db/rls.db.test.ts`
Expected: kst·kb-card 새 테스트 FAIL(`isValidKstDateTime is not a function`, unknown 대신 approval), RLS 새 테스트 2개 FAIL

- [ ] **Step 3: 구현**

`src/parsers/kst.ts` 끝에 추가:

```ts
/** 실제로 있는 날짜·시각인지 (2월 30일, 13월, 24시 등은 거짓) */
export function isValidKstDateTime(year: number, month: number, day: number, hour: number, minute: number): boolean {
  if (hour > 23 || minute > 59) return false;
  const k = new Date(kstDate(year, month, day, hour, minute).getTime() + KST_OFFSET_MS);
  return k.getUTCMonth() + 1 === month && k.getUTCDate() === day;
}
```

`src/parsers/kb-card.ts`의 import를 `import { inferYear, isValidKstDateTime, kstDate } from "./kst";`로 바꾸고, `const [month, day, hour, minute] = ...` 다음 줄을 아래로 바꾼다:

```ts
    const year = inferYear(month, receivedAt);
    if (!isValidKstDateTime(year, month, day, hour, minute)) return { kind: "unknown" };
    return {
      kind: header[1] === "승인" ? "approval" : "cancel",
      amount: Number(amount[1].replaceAll(",", "")),
      merchant,
      occurredAt: kstDate(year, month, day, hour, minute),
      issuer: "kb",
    };
```

`supabase/migrations/20261001000600_rls_references.sql`:

```sql
-- 카테고리는 기본 또는 내 그룹 것만 쓸 수 있다
create function public.is_my_category(p_category uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select p_category is null or exists (
    select 1 from public.categories
    where id = p_category and (group_id is null or group_id = public.my_group_id())
  )
$$;
revoke execute on function public.is_my_category(uuid) from public, anon;
grant execute on function public.is_my_category(uuid) to authenticated;

-- 거래: 직접 넣을 수 있는 칸을 제한하고 카테고리를 검사한다
revoke insert on public.transactions from authenticated;
grant insert (group_id, user_id, kind, amount, merchant, occurred_at, category_id, memo)
  on public.transactions to authenticated;

drop policy transactions_insert_manual on public.transactions;
create policy transactions_insert_manual on public.transactions
  for insert to authenticated
  with check (
    group_id = public.my_group_id()
    and kind = 'manual'
    and user_id in (select user_id from public.group_members where group_id = public.my_group_id())
    and public.is_my_category(category_id)
  );

drop policy transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (group_id = public.my_group_id())
  with check (
    group_id = public.my_group_id()
    and user_id in (select user_id from public.group_members where group_id = public.my_group_id())
    and public.is_my_category(category_id)
  );

drop policy merchant_rules_group on public.merchant_rules;
create policy merchant_rules_group on public.merchant_rules
  for all to authenticated
  using (group_id = public.my_group_id())
  with check (group_id = public.my_group_id() and public.is_my_category(category_id));

drop policy budgets_group on public.budgets;
create policy budgets_group on public.budgets
  for all to authenticated
  using (group_id = public.my_group_id())
  with check (group_id = public.my_group_id() and public.is_my_category(category_id));
```

```bash
supabase db reset
```

- [ ] **Step 4: 통과 확인과 전체 검증**

```bash
pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan
```
Expected: 단위 30 passed, DB 47 passed

- [ ] **Step 5: 사용자 승인 후 커밋**

```bash
git add src/parsers supabase/migrations tests/db/rls.db.test.ts
git commit -m "fix: 있을 수 없는 날짜와 다른 그룹 카테고리·연결 칸 차단

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 운영자 지정 스크립트

**Files:**
- Create: `src/auth/operator.ts`, `scripts/grant-operator.ts`, `tests/db/operator.db.test.ts`
- Modify: `package.json`, `tsconfig.json`, `README.md`

**Interfaces:**
- Produces: `grantOperator(admin: SupabaseClient, email: string, displayName: string): Promise<string>`(user id), 스크립트 `pnpm operator:grant <이메일> [이름]`

- [ ] **Step 1: 실패하는 테스트** — `tests/db/operator.db.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { grantOperator } from "@/auth/operator";
import { adminClient } from "../helpers/db";

const admin = adminClient();

describe("grantOperator", () => {
  it("없는 이메일이면 계정·프로필을 만들고 운영자로 지정한다", async () => {
    const email = `Op-${Date.now()}@Test.Local`;
    const userId = await grantOperator(admin, email, "운영자");
    const { data } = await admin.from("profiles").select("display_name, is_operator, can_create_group").eq("user_id", userId).single();
    expect(data).toEqual({ display_name: "운영자", is_operator: true, can_create_group: true });
    const { data: user } = await admin.auth.admin.getUserById(userId);
    expect(user.user?.email).toBe(email.toLowerCase());
  });

  it("이미 있는 계정이면 같은 사용자를 운영자로 바꾼다", async () => {
    const email = `op2-${Date.now()}@test.local`;
    const first = await grantOperator(admin, email, "처음");
    const second = await grantOperator(admin, email, "다시");
    expect(second).toBe(first);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run tests/db/operator.db.test.ts`
Expected: FAIL — `Cannot find package '@/auth/operator'`

- [ ] **Step 3: 구현** — `src/auth/operator.ts`

스크립트가 Node(타입 제거 실행)로 직접 import하므로 `@/` 경로 별칭을 쓰지 않는다.

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** 이메일 계정을 (없으면 만들어) 운영자로 지정한다. 초대·인원 제한을 거치지 않는 유일한 가입 경로다. */
export async function grantOperator(admin: SupabaseClient, email: string, displayName: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const created = await admin.auth.admin.createUser({ email: normalized, email_confirm: true });
  let userId: string;
  if (created.error) {
    if (created.error.code !== "email_exists") throw created.error;
    userId = await findUserIdByEmail(admin, normalized);
  } else {
    userId = created.data.user.id;
  }

  const { error } = await admin
    .from("profiles")
    .upsert(
      { user_id: userId, display_name: displayName, is_operator: true, can_create_group: true },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  return userId;
}

async function findUserIdByEmail(admin: SupabaseClient, email: string): Promise<string> {
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user) return user.id;
    if (data.users.length < perPage) throw new Error(`사용자를 찾을 수 없습니다: ${email}`);
  }
}
```

`scripts/grant-operator.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { grantOperator } from "../src/auth/operator.ts";

const [email, name = "운영자"] = process.argv.slice(2);
if (!email) {
  console.error("사용법: pnpm operator:grant <이메일> [이름]");
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local)");
  process.exit(1);
}

const userId = await grantOperator(createClient(url, key, { auth: { persistSession: false } }), email, name);
console.log(`운영자 지정 완료: ${email} (${userId})`);
```

`package.json` scripts에 추가:

```json
"operator:grant": "node --env-file=.env.local scripts/grant-operator.ts"
```

`tsconfig.json`의 `exclude` 배열에 `"scripts"`를 추가한다(`.ts` 확장자 import는 Node 실행 전용).

- [ ] **Step 4: 통과 확인과 스크립트 실행**

```bash
pnpm vitest run tests/db/operator.db.test.ts
pnpm operator:grant script-check@test.local 확인용
```
Expected: 2 passed, `운영자 지정 완료: script-check@test.local (...)`

- [ ] **Step 5: README에 운영자 지정 방법 추가**

`README.md`의 `## 결제 문자 수신 API` 앞에 추가:

````markdown
## 운영자 지정

초대 없이 가입할 수 있는 사람은 운영자뿐이다. 서버 전용 키로 직접 지정한다. 이메일은 운영자가 로그인할 **Google 계정 이메일**이어야 한다(같은 이메일의 Google 로그인과 자동으로 연결된다).

```bash
pnpm operator:grant <이메일> [이름]                                            # 로컬 DB (.env.local)
node --env-file=.env.cloud scripts/grant-operator.ts <이메일> [이름]           # 클라우드 DB
```
````

- [ ] **Step 6: 전체 검증 후 사용자 승인 받아 커밋**

```bash
pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan
git add src/auth/operator.ts scripts/grant-operator.ts tests/db/operator.db.test.ts package.json tsconfig.json README.md
git commit -m "feat: 운영자 지정 스크립트 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: DB 49 passed

---

### Task 5: 로그인·초대 수락 화면

**Files:**
- Create: `src/auth/display-name.ts`, `src/auth/display-name.test.ts`, `src/lib/session.ts`, `src/app/login/page.tsx`, `src/app/login/actions.ts`, `src/app/auth/no-profile/route.ts`, `src/app/invite/[token]/page.tsx`, `src/app/invite/[token]/actions.ts`, `src/app/actions.ts`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

**Interfaces:**
- Consumes: `createSupabaseServerClient`, `safeNextPath`(Task 1), `createAdminClient`(계획 1), `getInviteStatus`, `inviteStatusError`, `acceptInvite`, `errorMessage`(Task 2)
- Produces:
  - `defaultDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string`
  - `type Me = { userId: string; displayName: string; isOperator: boolean; canCreateGroup: boolean; groupId: string | null; groupName: string | null; role: "owner" | "member" | null }`
  - `loadMe(): Promise<{ supabase: SupabaseClient; me: Me }>` (비로그인 → `/login`, 프로필 없음 → `/auth/no-profile`)
  - 서버 액션 `signInWithGoogle(next: string)`, `signOut()`, `acceptInviteAction(token: string, formData: FormData)`

- [ ] **Step 1: 실패하는 기본 이름 테스트** — `src/auth/display-name.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { defaultDisplayName } from "./display-name";

describe("defaultDisplayName", () => {
  it("Google 이름(full_name → name) 순으로 쓴다", () => {
    expect(defaultDisplayName({ email: "a@gmail.com", user_metadata: { full_name: " 홍길동 ", name: "길동" } })).toBe("홍길동");
    expect(defaultDisplayName({ email: "a@gmail.com", user_metadata: { name: "길동" } })).toBe("길동");
  });

  it("이름이 없으면 이메일 앞부분", () => {
    expect(defaultDisplayName({ email: "gildong@gmail.com", user_metadata: {} })).toBe("gildong");
    expect(defaultDisplayName({ email: null })).toBe("");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run src/auth/display-name.test.ts`
Expected: FAIL — `Cannot find module './display-name'`

- [ ] **Step 3: 구현** — `src/auth/display-name.ts`

```ts
/** 초대 수락 화면의 이름 기본값: Google 프로필 이름, 없으면 이메일 앞부분 */
export function defaultDisplayName(user: { email?: string | null; user_metadata?: Record<string, unknown> }): string {
  const meta = user.user_metadata ?? {};
  for (const key of ["full_name", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return user.email?.split("@")[0] ?? "";
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run src/auth/display-name.test.ts`
Expected: 2 passed

- [ ] **Step 5: 세션 정보** — `src/lib/session.ts`

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase-server";

export type Me = {
  userId: string;
  displayName: string;
  isOperator: boolean;
  canCreateGroup: boolean;
  groupId: string | null;
  groupName: string | null;
  role: "owner" | "member" | null;
};

/** 로그인 사용자와 프로필·그룹. 로그인하지 않았으면 /login, 초대 수락 전(프로필 없음)이면 로그아웃 경로로 보낸다. */
export async function loadMe(): Promise<{ supabase: SupabaseClient; me: Me }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_operator, can_create_group")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/auth/no-profile");

  const { data: member } = await supabase
    .from("group_members")
    .select("group_id, role, groups(name)")
    .eq("user_id", user.id)
    .maybeSingle();
  const group = member?.groups as { name: string } | null | undefined;

  return {
    supabase,
    me: {
      userId: user.id,
      displayName: profile.display_name,
      isOperator: profile.is_operator,
      canCreateGroup: profile.can_create_group,
      groupId: member?.group_id ?? null,
      groupName: group?.name ?? null,
      role: (member?.role as Me["role"]) ?? null,
    },
  };
}
```

`src/app/auth/no-profile/route.ts` (서버 컴포넌트는 쿠키를 지울 수 없으므로 라우트에서 로그아웃한다):

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 초대 수락 전 계정으로 로그인한 경우: 로그아웃하고 안내한다. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?error=no_profile", process.env.APP_URL));
}
```

- [ ] **Step 6: 로그인 화면**

`src/app/login/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Google 로그인 화면으로 보낸다. 돌아오면 /auth/callback이 세션을 만들고 next로 이동시킨다. */
export async function signInWithGoogle(next: string) {
  const supabase = await createSupabaseServerClient();
  const redirectTo = `${process.env.APP_URL}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error || !data.url) redirect("/login?error=login_failed");
  redirect(data.url);
}
```

`src/app/login/page.tsx`:

```tsx
import { errorMessage } from "@/auth/messages";
import { signInWithGoogle } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">로그인</h1>
      {error && <p className="mb-3 text-red-600">{errorMessage(error)}</p>}
      <form action={signInWithGoogle.bind(null, "/")}>
        <button className="w-full rounded border p-2">Google로 로그인</button>
      </form>
      <p className="mt-4 text-sm text-gray-500">처음이라면 받은 초대 링크에서 가입하세요.</p>
    </main>
  );
}
```

- [ ] **Step 7: 초대 수락 화면**

`src/app/invite/[token]/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/auth/invites";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** 로그인한 사용자가 초대를 수락한다. 서비스 초대면 그룹 만들기로, 그룹 초대면 홈으로. */
export async function acceptInviteAction(token: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const supabase = await createSupabaseServerClient();
  const accepted = await acceptInvite(supabase, token, name);
  if (!accepted.ok) redirect(`/invite/${encodeURIComponent(token)}?error=${accepted.reason}`);
  redirect(accepted.value.kind === "service" ? "/group/new" : "/");
}
```

`src/app/invite/[token]/page.tsx`:

```tsx
import { defaultDisplayName } from "@/auth/display-name";
import { getInviteStatus, inviteStatusError } from "@/auth/invites";
import { errorMessage } from "@/auth/messages";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { signInWithGoogle } from "../../login/actions";
import { acceptInviteAction } from "./actions";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const status = await getInviteStatus(createAdminClient(), token);

  if (status.status !== "valid") {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="mb-4 text-xl font-bold">초대</h1>
        <p className="text-red-600">{errorMessage(inviteStatusError(status.status))}</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const title = status.kind === "group" ? `"${status.groupName}" 가계부에 초대받았습니다` : "가계부 서비스에 초대받았습니다";
  const here = `/invite/${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">{title}</h1>
      {error && <p className="mb-3 text-red-600">{errorMessage(error)}</p>}
      {user ? (
        <form action={acceptInviteAction.bind(null, token)} className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">{user.email} 계정으로 수락합니다.</p>
          <label className="text-sm">
            가계부에 표시할 이름
            <input name="name" required defaultValue={defaultDisplayName(user)} className="mt-1 w-full rounded border p-2" />
          </label>
          <button className="rounded bg-black p-2 text-white">수락</button>
        </form>
      ) : (
        <form action={signInWithGoogle.bind(null, here)}>
          <button className="w-full rounded border p-2">Google로 가입</button>
        </form>
      )}
    </main>
  );
}
```

- [ ] **Step 8: 홈·로그아웃**

`src/app/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

`src/app/page.tsx`를 다음으로 바꾼다:

```tsx
import Link from "next/link";
import { loadMe } from "@/lib/session";
import { signOut } from "./actions";

export default async function Home() {
  const { me } = await loadMe();
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-1 text-xl font-bold">{me.displayName}님</h1>
      <p className="mb-6 text-gray-600">
        {me.groupName ? `${me.groupName} (${me.role === "owner" ? "그룹장" : "그룹원"})` : "아직 그룹이 없습니다"}
      </p>
      <nav className="flex flex-col gap-2">
        {!me.groupId && me.canCreateGroup && <Link className="underline" href="/group/new">그룹 만들기</Link>}
        {me.groupId && <Link className="underline" href="/group">그룹</Link>}
        {me.groupId && <Link className="underline" href="/devices">내 기기 연결</Link>}
        {me.isOperator && <Link className="underline" href="/operator">운영자</Link>}
      </nav>
      <form action={signOut} className="mt-8">
        <button className="text-sm text-gray-500 underline">로그아웃</button>
      </form>
    </main>
  );
}
```

`src/app/layout.tsx`의 `metadata`를 다음으로 바꾸고 `<html lang="en">`을 `<html lang="ko">`로 바꾼다:

```ts
export const metadata: Metadata = {
  title: "nof-payments-book",
  description: "부부·커플이 함께 쓰는 결제 문자 가계부",
};
```

- [ ] **Step 9: 전체 검증 후 사용자 승인 받아 커밋**

```bash
pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan
git add src
git commit -m "feat: Google 로그인과 초대 수락 화면 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Expected: 단위 32 passed, DB 49 passed

---

### Task 6: 그룹·운영자·내 기기 화면

**Files:**
- Create: `src/components/one-time-secret-form.tsx`, `src/app/group/new/page.tsx`, `src/app/group/page.tsx`, `src/app/group/actions.ts`, `src/app/operator/page.tsx`, `src/app/operator/actions.ts`, `src/app/devices/page.tsx`, `src/app/devices/actions.ts`

**Interfaces:**
- Consumes: `loadMe`(Task 5), `createGroup`·`createGroupInvite`·`revokeGroupInvite`·`createServiceInvite`·`issueIngestToken`·`revokeIngestToken`(Task 2), `errorMessage`, `createAdminClient`
- Produces: `type SecretState = { value?: string; error?: string } | null`, `<OneTimeSecretForm action buttonLabel valueLabel>`

- [ ] **Step 1: 한 번만 보이는 값 폼** — `src/components/one-time-secret-form.tsx`

초대 링크·기기 토큰을 URL에 남기지 않고 액션 결과로만 화면에 보여 준다.

```tsx
"use client";

import { useActionState, type ReactNode } from "react";

export type SecretState = { value?: string; error?: string } | null;

export function OneTimeSecretForm({
  action,
  buttonLabel,
  valueLabel,
  children,
}: {
  action: (prev: SecretState, formData: FormData) => Promise<SecretState>;
  buttonLabel: string;
  valueLabel: string;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {children}
      <button disabled={pending} className="rounded bg-black p-2 text-white disabled:opacity-50">
        {buttonLabel}
      </button>
      {state?.error && <p className="text-red-600">{state.error}</p>}
      {state?.value && (
        <div className="rounded border border-amber-400 bg-amber-50 p-2">
          <p className="mb-1 text-sm">{valueLabel} — 이 화면을 벗어나면 다시 볼 수 없습니다.</p>
          <input
            readOnly
            value={state.value}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded border p-2 font-mono text-xs"
          />
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 2: 그룹 화면**

`src/app/group/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createGroup, createGroupInvite, revokeGroupInvite } from "@/auth/groups";
import { errorMessage } from "@/auth/messages";
import type { SecretState } from "@/components/one-time-secret-form";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function createGroupAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const result = await createGroup(supabase, String(formData.get("name") ?? ""));
  if (!result.ok) redirect(`/group/new?error=${result.reason}`);
  redirect("/group");
}

export async function createGroupInviteAction(_prev: SecretState, _formData: FormData): Promise<SecretState> {
  const supabase = await createSupabaseServerClient();
  const result = await createGroupInvite(supabase);
  if (!result.ok) return { error: errorMessage(result.reason) };
  revalidatePath("/group");
  return { value: `${process.env.APP_URL}/invite/${result.value.token}` };
}

export async function revokeGroupInviteAction(inviteId: string) {
  const supabase = await createSupabaseServerClient();
  await revokeGroupInvite(supabase, inviteId);
  revalidatePath("/group");
}
```

`src/app/group/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { errorMessage } from "@/auth/messages";
import { loadMe } from "@/lib/session";
import { createGroupAction } from "../actions";

export default async function NewGroupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { me } = await loadMe();
  if (me.groupId) redirect("/group");
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">그룹 만들기</h1>
      {error && <p className="mb-3 text-red-600">{errorMessage(error)}</p>}
      {me.canCreateGroup ? (
        <form action={createGroupAction} className="flex flex-col gap-3">
          <input name="name" required placeholder="그룹 이름 (예: 우리집 가계부)" className="rounded border p-2" />
          <button className="rounded bg-black p-2 text-white">만들기</button>
        </form>
      ) : (
        <p>{errorMessage("not_allowed")}</p>
      )}
    </main>
  );
}
```

`src/app/group/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { OneTimeSecretForm } from "@/components/one-time-secret-form";
import { loadMe } from "@/lib/session";
import { createGroupInviteAction, revokeGroupInviteAction } from "./actions";

const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

export default async function GroupPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect(me.canCreateGroup ? "/group/new" : "/");

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, role, profiles(display_name)")
    .eq("group_id", me.groupId);
  const { data: invites } = me.role === "owner"
    ? await supabase.from("group_invites").select("id, expires_at, used_at, revoked_at, created_at").order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href="/" className="text-sm underline">← 홈</Link>
      <h1 className="my-4 text-xl font-bold">{me.groupName}</h1>
      <h2 className="mb-2 font-semibold">구성원</h2>
      <ul className="mb-6 list-disc pl-5">
        {(members ?? []).map((m) => (
          <li key={m.user_id}>
            {(m.profiles as unknown as { display_name: string } | null)?.display_name} {m.role === "owner" && "(그룹장)"}
          </li>
        ))}
      </ul>

      {me.role === "owner" && (
        <>
          <h2 className="mb-2 font-semibold">초대</h2>
          <OneTimeSecretForm action={createGroupInviteAction} buttonLabel="초대 링크 만들기" valueLabel="초대 링크" />
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {(invites ?? []).map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded border p-2">
                <span>
                  {fmt(i.created_at)} ·{" "}
                  {i.used_at ? "사용됨" : i.revoked_at ? "취소됨" : new Date(i.expires_at) < new Date() ? "만료" : `~${fmt(i.expires_at)}`}
                </span>
                {!i.used_at && !i.revoked_at && (
                  <form action={revokeGroupInviteAction.bind(null, i.id)}>
                    <button className="text-red-600 underline">취소</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: 운영자 화면**

`src/app/operator/actions.ts`:

```ts
"use server";

import { createServiceInvite } from "@/auth/groups";
import { errorMessage } from "@/auth/messages";
import type { SecretState } from "@/components/one-time-secret-form";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function createServiceInviteAction(_prev: SecretState, _formData: FormData): Promise<SecretState> {
  const supabase = await createSupabaseServerClient();
  const result = await createServiceInvite(supabase);
  if (!result.ok) return { error: errorMessage(result.reason) };
  return { value: `${process.env.APP_URL}/invite/${result.value.token}` };
}
```

`src/app/operator/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { OneTimeSecretForm } from "@/components/one-time-secret-form";
import { loadMe } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServiceInviteAction } from "./actions";

export default async function OperatorPage() {
  const { me } = await loadMe();
  if (!me.isOperator) redirect("/");

  // 운영자 현황은 RLS 범위(자기 그룹)를 넘으므로 서버 전용 키로 센다. 운영자 확인 뒤에만 쓴다.
  const admin = createAdminClient();
  const [{ count: users }, { data: maxUsers }, { data: groups }] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("app_settings").select("value").eq("key", "max_users").single(),
    admin.from("groups").select("id, name, created_at, group_members(count)").order("created_at"),
  ]);

  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href="/" className="text-sm underline">← 홈</Link>
      <h1 className="my-4 text-xl font-bold">운영자</h1>
      <p className="mb-4">사용자 {users ?? 0} / {String(maxUsers?.value ?? "-")}명</p>
      <OneTimeSecretForm action={createServiceInviteAction} buttonLabel="서비스 초대 링크 만들기" valueLabel="서비스 초대 링크" />
      <h2 className="mb-2 mt-6 font-semibold">그룹</h2>
      <ul className="list-disc pl-5 text-sm">
        {(groups ?? []).map((g) => (
          <li key={g.id}>
            {g.name} ({(g.group_members as unknown as { count: number }[])[0]?.count ?? 0}명)
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: 내 기기 화면**

`src/app/devices/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { issueIngestToken, revokeIngestToken } from "@/auth/groups";
import { errorMessage } from "@/auth/messages";
import type { SecretState } from "@/components/one-time-secret-form";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function issueTokenAction(_prev: SecretState, formData: FormData): Promise<SecretState> {
  const supabase = await createSupabaseServerClient();
  const result = await issueIngestToken(supabase, String(formData.get("label") ?? ""));
  if (!result.ok) return { error: errorMessage(result.reason) };
  revalidatePath("/devices");
  return { value: result.value.token };
}

export async function revokeTokenAction(tokenId: string) {
  const supabase = await createSupabaseServerClient();
  await revokeIngestToken(supabase, tokenId);
  revalidatePath("/devices");
}
```

`src/app/devices/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { OneTimeSecretForm } from "@/components/one-time-secret-form";
import { loadMe } from "@/lib/session";
import { issueTokenAction, revokeTokenAction } from "./actions";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음");

export default async function DevicesPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const { data: tokens } = await supabase
    .from("ingest_tokens")
    .select("id, label, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-sm p-6">
      <Link href="/" className="text-sm underline">← 홈</Link>
      <h1 className="my-4 text-xl font-bold">내 기기 연결</h1>
      <p className="mb-2 text-sm text-gray-600">
        단축어(아이폰)·MacroDroid(갤럭시)에서 <code>{process.env.APP_URL}/api/ingest</code>로 결제 문자를 보낼 때
        <code> Authorization: Bearer &lt;토큰&gt;</code> 헤더에 넣습니다. 기기별 자세한 설정 안내는 계획 3에서 추가합니다.
      </p>
      <OneTimeSecretForm action={issueTokenAction} buttonLabel="토큰 발급" valueLabel="기기 토큰">
        <input name="label" placeholder="기기 이름 (예: 내 아이폰)" className="rounded border p-2" />
      </OneTimeSecretForm>
      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {(tokens ?? []).map((t) => (
          <li key={t.id} className="rounded border p-2">
            <div className="font-semibold">{t.label || "(이름 없음)"} {t.revoked_at && <span className="text-red-600">폐기됨</span>}</div>
            <div>발급 {fmt(t.created_at)} · 마지막 수신 {fmt(t.last_used_at)}</div>
            {!t.revoked_at && (
              <form action={revokeTokenAction.bind(null, t.id)}>
                <button className="text-red-600 underline">폐기</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 5: 전체 검증 후 사용자 승인 받아 커밋**

```bash
pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm secrets:scan
git add src
git commit -m "feat: 그룹·운영자·내 기기 화면 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 처음부터 끝까지 수동 확인과 클라우드 적용

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 로컬에서 전체 흐름 확인 (사용자와 함께, Google 계정 2개 필요)**

계정 A(본인, 운영자)와 계정 B(배우자 역할)가 필요하다. 둘 다 Google OAuth 동의 화면의 **테스트 사용자**에 등록돼 있어야 한다.

```bash
supabase db reset
pnpm operator:grant <계정 A Gmail> 운영자
pnpm dev
```

1. 일반 창: `http://127.0.0.1:3100/` → `/login` → Google로 로그인(A) → 홈에 "운영자" 링크
2. 시크릿 창: `/login`에서 Google로 로그인(B) → "초대받은 링크로 가입을 마쳐 주세요" 표시, 로그아웃 상태(초대 없이 로그인 차단 확인)
3. 일반 창(A): 운영자 → 서비스 초대 링크 만들기 → 복사
4. 시크릿 창(B): 링크 열기 → Google로 가입 → 이름 확인 → 수락 → `/group/new` → 그룹 만들기
5. 시크릿 창(B): 같은 서비스 초대 링크를 다시 열면 "이미 사용된 초대 링크"
6. 시크릿 창(B): 그룹 → 초대 링크 만들기 → 복사
7. 일반 창(A): 그룹 초대 링크 열기 → 수락 → 홈에 그룹 이름(그룹원)
8. 각자 내 기기 연결 → 토큰 발급 → 아래 curl로 문자 전송 → `parsed`, 목록의 마지막 수신 시각 갱신
9. 토큰 폐기 → 같은 curl이 `401`

```bash
curl -s -X POST http://127.0.0.1:3100/api/ingest \
  -H "authorization: Bearer <발급한 토큰>" -H "content-type: application/json" \
  -d '{"body":"[Web발신]\nKB국민카드1234승인\n홍*동님\n4,500원 일시불\n10/01 12:00\n수동확인상점\n누적100,000원","source":"manual_test"}'
```

- [ ] **Step 2: README에 가입 흐름 추가**

`README.md`의 `## 운영자 지정` 앞에 추가:

```markdown
## 가입 흐름

1. 운영자가 `/operator`에서 서비스 초대 링크를 만든다.
2. 초대받은 사람이 링크에서 **Google로 가입**하고 이름을 확인해 수락한 뒤 그룹을 만든다.
3. 그룹장이 `/group`에서 배우자 초대 링크를 만든다(그룹당 2명). 배우자도 링크에서 Google로 가입한다.
4. 이후에는 `/login`에서 Google로 로그인한다.
5. 각자 `/devices`에서 기기 토큰을 발급받아 단축어·MacroDroid에 넣는다.

초대 없이 Google 로그인하면 바로 로그아웃되고 안내가 나온다.

### 로컬 Google 로그인 설정

Google Cloud Console에서 웹 애플리케이션 OAuth 클라이언트를 만들고, 리디렉션 URI에
`http://127.0.0.1:54321/auth/v1/callback`을 넣는다. 클라이언트 ID·비밀값은 `supabase/.env`(git 제외)에 둔다.

```dotenv
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
```
```

- [ ] **Step 3: 사용자 승인 후 커밋·push**

```bash
pnpm secrets:scan
git add README.md
git commit -m "docs: 가입 흐름과 Google 로그인 설정 설명 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: 사용자 승인 후 클라우드 마이그레이션 적용**

```bash
supabase db push --dry-run
supabase db push
supabase migration list
```
Expected: `20261001000500`, `20261001000600`이 클라우드에도 적용됨

클라우드 Supabase의 Google 로그인 연결, 이메일 가입 끔, site_url·이동 허용 주소는 앱 주소가 정해지는 계획 4에서 설정한다.
