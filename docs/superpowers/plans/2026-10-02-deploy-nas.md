# NAS 배포 (계획 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가계부를 NAS(DS920+)의 Container Manager 프로젝트로 실행하고 Cloudflare Tunnel로 `https://ledger.<도메인>`에 공개하며, 태그 기반 자동 배포와 매일 DB 백업을 갖춘다.

**Architecture:** 저장소 쪽(Task 1~4)은 TDD로 만든다: `/api/health`, 빌드 인자를 받는 `Dockerfile`, GHCR로 올리는 GitHub Actions, NAS용 `deploy/` 묶음(compose·백업 스크립트·환경 견본), 새 DB 마이그레이션 확인 스크립트. 운영 쪽(Task 5~10)은 상태를 바꾸는 작업이라 **각 Task 시작 전 사용자 승인** 후 Claude가 CLI·SSH·Chrome으로 수행하고, 확인 명령의 결과로 끝을 판정한다.

**Tech Stack:** Next.js 16 standalone, Docker(buildx, linux/amd64), GitHub Actions, GHCR, Synology DSM 7.1 Container Manager(docker compose), Cloudflare Tunnel(`cloudflare/cloudflared`), `nickfedor/watchtower`, `postgres:17-alpine`(pg_dump), Supabase CLI·Management API, Playwright

**Spec:** `docs/superpowers/specs/2026-10-02-deploy-nas-design.md`

## Global Constraints

- 작업 원칙: **각 Task 시작 전과 모든 커밋 전에 사용자 승인.** 운영 Task(5~10)는 하나하나가 외부 상태를 바꾸므로 반드시 시작 전 승인. 상태 확인(읽기)은 구분해 진행한다.
- 공개 저장소: 실제 도메인·주소·NAS 경로·비밀값을 커밋하지 않는다. 문서에는 `ledger.<도메인>`, `<NAS 폴더>`로 쓴다. 커밋 전 `.githooks/pre-commit` 통과.
- 비밀값은 화면·대화·로그에 출력하지 않는다. 파일에서 읽어 바로 쓰거나 사용자가 자기 터미널에서 입력한다. 확인은 길이·존재 여부로만 한다.
- 이 Mac의 클라우드 접속값은 `.env.cloud`(git 제외, 권한 600, 커밋 전 검사가 이미 대조함)에 둔다.
- DB 비밀번호는 사용자가 자기 터미널에서 `~/.config/nof-ledger/db_password`(600)에 직접 쓴다(이 세션의 `!` 명령은 숨김 입력이 안 될 수 있음).
- 이 Next.js는 학습 데이터와 다르다. 새 API는 `node_modules/next/dist/docs/`를 먼저 읽는다.
- 검증(저장소 Task): `pnpm test`, `pnpm test:db`, `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`, `pnpm secrets:scan`.
- 로컬 DB는 `supabase db reset` 금지. 새 DB 확인은 임시 복사본의 별도 Supabase로 한다(Task 4).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **이미지 안의 비밀값**: 빌드된 이미지에 `SUPABASE_SERVICE_ROLE_KEY`·`TYPESAFE_API_KEY`·`.env*`가 들어가지 않아야 한다(공개 이미지). → Task 2(이미지 파일 목록·환경 검사)
2. **Tunnel 뒤의 서버 액션·로그인**: Host가 `ledger.<도메인>`일 때 서버 액션(Origin 검사)과 Google 로그인 콜백이 동작해야 한다. → Task 10(실기기 확인 목록)
3. **백업 보관 정리**: 30일 지난 덤프만 지우고, 덤프가 실패하면 빈 파일을 남기거나 기존 파일을 지우지 않아야 한다. → Task 3 테스트
4. **클라우드 마이그레이션 실패**: 그룹 카테고리 이름 중복 등으로 실패하면 적용 전 백업이 있고 DB가 이전 상태로 남아야 한다. → Task 4(새 DB), Task 5(중복 확인·사전 백업)
5. **Watchtower 범위**: `app`만 갱신하고 `cloudflared`·`backup`·자기 자신은 건드리지 않아야 한다. → Task 3(compose 라벨 검사), Task 10

## 스펙과 다르게 구체화한 부분

- 이 Mac의 클라우드 접속값 파일은 `.env.production.local`이 아니라 `.env.cloud`(커밋 전 검사가 이미 대조하는 이름). 설계 문서 5장을 함께 고친다(Task 1).
- 백업은 `postgres:17-alpine`의 셸 반복문으로 KST 04:00을 기다려 실행한다(cron 데몬 없이). 시험용으로 `RUN_ONCE=1`이면 한 번 실행하고 끝난다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/app/api/health/route.ts` | 배포 확인용 상태·버전 |
| `src/auth/paths.ts` | `/api/health` 공개 경로 |
| `Dockerfile` | 빌드 인자(`NEXT_PUBLIC_*`, `GIT_SHA`) |
| `.github/workflows/image.yml` | 태그·수동 실행 → amd64 이미지 → GHCR |
| `deploy/compose.yaml` | NAS 프로젝트(app·cloudflared·watchtower·backup) |
| `deploy/.env.example` | NAS `.env` 키 이름 견본 |
| `deploy/backup.sh` | 매일 KST 04:00 pg_dump, 30일 정리 |
| `scripts/verify-fresh-migrations.sh` | 임시 복사본 Supabase로 마이그레이션 전체 확인 |
| `docs/deploy/README.md` | 실제 수행 순서 기록(재설치용) |
| `e2e/health.spec.ts`, `tests/deploy/backup.test.sh` | 테스트 |

---

### Task 1: `/api/health`와 빌드 인자

**Files:**
- Create: `src/app/api/health/route.ts`, `e2e/health.spec.ts`
- Modify: `src/auth/paths.ts`, `src/auth/paths.test.ts`, `Dockerfile`, `docs/superpowers/specs/2026-10-02-deploy-nas-design.md`(`.env.production.local` → `.env.cloud`)

**Interfaces:**
- Produces: `GET /api/health` → `200 {"ok":true,"version":"<GIT_SHA 앞 7자리 | dev>"}`, 로그인 불필요. `Dockerfile` 빌드 인자 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GIT_SHA`.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/auth/paths.test.ts`의 `describe("isPublicPath")` 안에 추가:

```ts
  it("배포 확인 주소는 로그인 없이 연다", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/healthx")).toBe(false);
  });
```

`e2e/health.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("배포 확인 주소는 로그인 없이 버전을 돌려준다", async ({ request }) => {
  const res = await request.get("/api/health", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect(await res.json()).toEqual({ ok: true, version: "dev" });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm vitest run src/auth/paths.test.ts; pnpm test:e2e e2e/health.spec.ts`
Expected: FAIL (`/api/health`가 공개 경로 아님, 307 또는 404)

- [ ] **Step 3: 구현**

`src/auth/paths.ts`의 `isPublicPath` 마지막 조건 뒤에 추가:

```ts
    pathname === "/apple-icon" ||
    // 배포 확인(버전만 돌려주고 DB를 부르지 않는다)
    pathname === "/api/health"
```

(기존 `pathname === "/apple-icon"` 줄을 위 두 줄로 바꾼다.)

`src/app/api/health/route.ts`:

```ts
export const dynamic = "force-dynamic";

/** 배포 확인용. DB를 부르지 않고 빌드한 커밋만 알려 준다. */
export function GET(): Response {
  const sha = process.env.GIT_SHA;
  return Response.json(
    { ok: true, version: sha ? sha.slice(0, 7) : "dev" },
    { headers: { "cache-control": "no-store" } },
  );
}
```

`Dockerfile`의 `build` 단계를 다음으로 바꾼다(빌드 인자는 이미지에 공개 값만 넣는다):

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
# 브라우저로 나가는 공개 값만 빌드 때 넣는다. 서버 비밀값은 실행할 때 환경으로 준다.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
```

`run` 단계의 `ENV` 줄 바로 앞에 추가:

```dockerfile
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA
```

`docs/superpowers/specs/2026-10-02-deploy-nas-design.md`의 `.env.production.local`을 모두 `.env.cloud`로 바꾸고, 4장 1번의 "커밋 전 검사가 `.env.production.local` 값도 대조하도록 확장, " 문구를 지운다(이미 대조함).

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm vitest run src/auth/paths.test.ts && pnpm test:e2e e2e/health.spec.ts`
Expected: PASS

- [ ] **Step 5: 이미지 비밀값 검사 (Review Focus 1)**

```bash
docker build -t nof-ledger:check --build-arg NEXT_PUBLIC_SUPABASE_URL=http://example.invalid \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon --build-arg GIT_SHA=abcdef1234 .
docker run --rm nof-ledger:check sh -c 'ls -a; env | cut -d= -f1 | sort' | tee /tmp/claude-image-check.txt
! grep -E '^\.env|SERVICE_ROLE|TYPESAFE' /tmp/claude-image-check.txt && echo "비밀값 없음"
docker run -d --rm --name nof-ledger-check -p 3999:3000 nof-ledger:check && sleep 3
curl -s http://127.0.0.1:3999/api/health; docker stop nof-ledger-check
```

Expected: "비밀값 없음", `{"ok":true,"version":"abcdef1"}`. (이 Mac은 arm64라 동작 확인용 빌드다.)

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm test:db && npx tsc --noEmit && pnpm lint && pnpm build && pnpm test:e2e && pnpm secrets:scan`
Expected: 모두 통과

- [ ] **Step 7: 커밋 (사용자 승인 후)**

```bash
git add src/app/api/health src/auth/paths.ts src/auth/paths.test.ts Dockerfile e2e/health.spec.ts docs/superpowers/specs/2026-10-02-deploy-nas-design.md
git commit -m "feat: 배포 확인용 /api/health와 이미지 빌드 인자

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: GitHub Actions 이미지 빌드

**Files:**
- Create: `.github/workflows/image.yml`

**Interfaces:**
- Consumes: Task 1 빌드 인자
- Produces: `v*` 태그 푸시 또는 수동 실행(`ref` 입력) → `ghcr.io/vipuoow/nof-payments-book:<태그>`와 `:latest`(linux/amd64). 저장소 변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 사용.

- [ ] **Step 1: 워크플로 작성**

`.github/workflows/image.yml`:

```yaml
name: image

on:
  push:
    tags: ["v*"]
  workflow_dispatch:
    inputs:
      ref:
        description: "빌드할 태그 (되돌릴 때 이전 태그)"
        required: true

permissions:
  contents: read
  packages: write

concurrency:
  group: image
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.ref || github.ref }}
      - id: meta
        run: |
          echo "tag=${{ inputs.ref || github.ref_name }}" >> "$GITHUB_OUTPUT"
          echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          build-args: |
            NEXT_PUBLIC_SUPABASE_URL=${{ vars.NEXT_PUBLIC_SUPABASE_URL }}
            NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ vars.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
            GIT_SHA=${{ steps.meta.outputs.sha }}
          tags: |
            ghcr.io/vipuoow/nof-payments-book:${{ steps.meta.outputs.tag }}
            ghcr.io/vipuoow/nof-payments-book:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: 형식 검사**

Run: `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -color`
Expected: 출력 없음(통과)

- [ ] **Step 3: 전체 검증과 커밋 (사용자 승인 후)**

Run: `pnpm test && pnpm lint && pnpm secrets:scan`

```bash
git add .github/workflows/image.yml
git commit -m "ci: 태그를 붙이면 NAS용(amd64) 이미지를 GHCR에 올린다

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

실제 실행은 Task 7(태그)에서 확인한다.

---

### Task 3: NAS 프로젝트 묶음(compose·백업·환경 견본)

**Files:**
- Create: `deploy/compose.yaml`, `deploy/.env.example`, `deploy/backup.sh`, `tests/deploy/backup.test.sh`, `tests/deploy/compose.test.sh`
- Modify: `.gitignore`(`deploy/.env`, `deploy/backups/`), `package.json`(`test:deploy`)

**Interfaces:**
- Produces: NAS 폴더에 `compose.yaml`, `.env`, `backup.sh`, `backups/`를 두고 `docker compose up -d`로 실행. 백업 파일 이름 `ledger-YYYY-MM-DD.dump`(KST 날짜).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/deploy/backup.test.sh`(로컬 Supabase DB를 대상으로 `deploy/backup.sh`를 컨테이너에서 한 번 실행):

```sh
#!/bin/sh
# deploy/backup.sh 시험: 덤프 생성, 30일 지난 파일만 삭제, 실패 시 기존 파일 보존·빈 파일 없음
set -eu
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
run() {
  docker run --rm -e RUN_ONCE=1 -e TZ=Asia/Seoul -e BACKUP_DATABASE_URL="$1" \
    -v "$PWD/deploy/backup.sh:/backup.sh:ro" -v "$dir:/backups" \
    --add-host host.docker.internal:host-gateway postgres:17-alpine sh /backup.sh
}
# macOS(BSD) touch는 -d "N days ago"를 모른다
touch -t "$(date -v-40d +%Y%m%d%H%M)" "$dir/ledger-2000-01-01.dump"
touch -t "$(date -v-10d +%Y%m%d%H%M)" "$dir/ledger-2000-02-01.dump"

run "postgresql://postgres:postgres@host.docker.internal:54322/postgres"
today=$(TZ=Asia/Seoul date +%F)
[ -s "$dir/ledger-$today.dump" ] || { echo "FAIL: 오늘 덤프 없음"; exit 1; }
[ ! -e "$dir/ledger-2000-01-01.dump" ] || { echo "FAIL: 40일 지난 파일이 남음"; exit 1; }
[ -e "$dir/ledger-2000-02-01.dump" ] || { echo "FAIL: 10일 된 파일이 지워짐"; exit 1; }

rm "$dir/ledger-$today.dump"
if run "postgresql://postgres:wrong@host.docker.internal:54322/postgres"; then echo "FAIL: 실패를 성공으로 보고"; exit 1; fi
[ ! -e "$dir/ledger-$today.dump" ] || { echo "FAIL: 실패한 덤프 파일이 남음"; exit 1; }
[ -e "$dir/ledger-2000-02-01.dump" ] || { echo "FAIL: 실패 때 기존 파일이 지워짐"; exit 1; }
echo "PASS"
```

`tests/deploy/compose.test.sh`(형식 검사 + Watchtower가 `app`만 갱신하는지, Review Focus 5):

```sh
#!/bin/sh
set -eu
# :? 필수 값 검사를 통과시키려고 가짜 값을 준다
export SUPABASE_URL=x SUPABASE_SERVICE_ROLE_KEY=x APP_URL=x TUNNEL_TOKEN=x BACKUP_DATABASE_URL=x
docker compose -f deploy/compose.yaml config -q
docker compose -f deploy/compose.yaml config --format json | node -e '
  const c = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const on = Object.entries(c.services)
    .filter(([, s]) => s.labels?.["com.centurylinklabs.watchtower.enable"] === "true").map(([n]) => n);
  if (JSON.stringify(on) !== JSON.stringify(["app"])) { console.error("FAIL watchtower 대상", on); process.exit(1); }
  console.log("PASS watchtower 대상: app");'
```

`package.json` `scripts`에 추가: `"test:deploy": "sh tests/deploy/backup.test.sh && sh tests/deploy/compose.test.sh"`

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `pnpm test:deploy`
Expected: FAIL (`deploy/backup.sh` 없음)

- [ ] **Step 3: 구현**

`deploy/backup.sh`:

```sh
#!/bin/sh
# 매일 KST 04:00에 클라우드 DB를 덤프해 /backups에 30일 보관한다.
# RUN_ONCE=1이면 한 번만 실행하고 끝난다(시험·수동 백업용). 접속 주소는 출력하지 않는다.
set -u
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL가 필요합니다}"

backup() {
  day=$(date +%F)
  tmp="/backups/.ledger-$day.dump.partial"
  if pg_dump --format=custom --no-owner --dbname="$BACKUP_DATABASE_URL" --file="$tmp"; then
    mv "$tmp" "/backups/ledger-$day.dump"
    # 성공했을 때만 오래된 파일을 정리한다
    find /backups -name 'ledger-*.dump' -mtime +30 -delete
    echo "백업 완료: ledger-$day.dump"
  else
    rm -f "$tmp"
    echo "백업 실패: $day" >&2
    return 1
  fi
}

if [ "${RUN_ONCE:-0}" = "1" ]; then
  backup
  exit $?
fi

while true; do
  now=$(date +%s)
  next=$(date -d "$(date +%F) 04:00" +%s 2>/dev/null || date -D '%Y-%m-%d %H:%M' -d "$(date +%F) 04:00" +%s)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  backup || true
done
```

`deploy/compose.yaml`:

```yaml
# NAS Container Manager 프로젝트 "nof-ledger". 같은 폴더의 .env(권한 600)를 쓴다.
name: nof-ledger

services:
  app:
    image: ghcr.io/vipuoow/nof-payments-book:latest
    restart: unless-stopped
    environment:
      SUPABASE_URL: ${SUPABASE_URL:?}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:?}
      APP_URL: ${APP_URL:?}
      TYPESAFE_API_KEY: ${TYPESAFE_API_KEY:-}
    labels:
      com.centurylinklabs.watchtower.enable: "true"
    # 외부 포트를 열지 않는다. cloudflared만 app:3000으로 접속한다.

  cloudflared:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN:?}
    depends_on: [app]

  watchtower:
    image: nickfedor/watchtower:latest
    restart: unless-stopped
    environment:
      WATCHTOWER_LABEL_ENABLE: "true"
      WATCHTOWER_CLEANUP: "true"
      WATCHTOWER_POLL_INTERVAL: "300"
      TZ: Asia/Seoul
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  backup:
    image: postgres:17-alpine
    restart: unless-stopped
    command: sh /backup.sh
    environment:
      BACKUP_DATABASE_URL: ${BACKUP_DATABASE_URL:?}
      TZ: Asia/Seoul
    volumes:
      - ./backup.sh:/backup.sh:ro
      - ./backups:/backups
```

`deploy/.env.example`:

```bash
# NAS 프로젝트 폴더의 .env 견본. 실제 값은 NAS에만 두고(권한 600) 커밋하지 않는다.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
TYPESAFE_API_KEY=
TUNNEL_TOKEN=
# Supabase Session pooler 주소(IPv4). 비밀번호 포함.
BACKUP_DATABASE_URL=
```

`.gitignore`의 "키 파일" 묶음에 추가:

```gitignore
deploy/.env
deploy/backups/
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test:deploy`
Expected: `PASS`(백업), `PASS watchtower 대상: app`

- [ ] **Step 5: 전체 검증과 커밋 (사용자 승인 후)**

Run: `pnpm test && pnpm lint && pnpm secrets:scan`

```bash
git add deploy/compose.yaml deploy/.env.example deploy/backup.sh tests/deploy package.json .gitignore
git commit -m "feat: NAS 프로젝트 묶음(compose·매일 백업·환경 견본)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 새 DB 마이그레이션 확인 스크립트

**Files:**
- Create: `scripts/verify-fresh-migrations.sh`

**Interfaces:**
- Produces: 저장소를 임시 폴더에 복사하고 `project_id`와 포트(+1000)를 바꿔 별도 Supabase를 띄운 뒤, 마이그레이션 전체 적용 + `pnpm test:db`를 실행하고 정리한다. 기존 로컬 Supabase·데이터는 건드리지 않는다.

- [ ] **Step 1: 스크립트 작성**

`scripts/verify-fresh-migrations.sh`:

```sh
#!/bin/sh
# 새 DB에서 마이그레이션 전체가 적용되는지 확인한다. 기존 로컬 Supabase는 건드리지 않는다.
set -eu
root=$(pwd)
work=$(mktemp -d)
cleanup() { (cd "$work/repo" && supabase stop --no-backup >/dev/null 2>&1) || true; rm -rf "$work"; }
trap cleanup EXIT

git ls-files -z | (mkdir -p "$work/repo" && cd "$root" && xargs -0 tar cf -) | (cd "$work/repo" && tar xf -)
ln -s "$root/node_modules" "$work/repo/node_modules"
cd "$work/repo"
# 별도 프로젝트 이름과 겹치지 않는 포트
sed -i '' -e 's/^project_id = .*/project_id = "nof-fresh-check"/' \
  -e 's/^port = 543\([0-9][0-9]\)/port = 553\1/' -e 's/^shadow_port = 54320/shadow_port = 55320/' supabase/config.toml
supabase start -x studio,imgproxy,inbucket,mailpit,vector,logflare,edge-runtime >/dev/null
eval "$(supabase status -o env)"
cat > .env.test.local <<ENV
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ENV
pnpm test:db
echo "새 DB 마이그레이션 확인 완료"
```

- [ ] **Step 2: 실행**

Run: `sh scripts/verify-fresh-migrations.sh`
Expected: 마이그레이션 전체 적용, `test:db` 전부 통과, "새 DB 마이그레이션 확인 완료". 끝나면 `docker ps`에 `nof-fresh-check` 컨테이너가 없고 기존 `supabase_db_nof-payments-book`은 그대로.

`supabase start -x`에서 제외 이름이 CLI 버전과 다르면 실행 오류가 난다. 그때 `supabase start --help`로 이름을 확인해 고치고 Ruling으로 남긴다.

- [ ] **Step 3: 커밋 (사용자 승인 후)**

```bash
git add scripts/verify-fresh-migrations.sh
git commit -m "chore: 임시 Supabase로 새 DB 마이그레이션 전체 확인 스크립트

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 클라우드 DB 적용 (운영, 승인 필요)

**사전 준비(사용자)**: 자기 터미널에서

```sh
mkdir -p ~/.config/nof-ledger && chmod 700 ~/.config/nof-ledger
printf '%s' '<Supabase DB 비밀번호>' > ~/.config/nof-ledger/db_password && chmod 600 ~/.config/nof-ledger/db_password
```

그리고 이 세션에서 `! supabase login`(브라우저 인증).

- [ ] **Step 1: 연결 확인(읽기)**

```sh
supabase projects list | grep jmswewolwpjutohayrcf
supabase migration list --linked --password "$(cat ~/.config/nof-ledger/db_password)"
```

Expected: 프로젝트가 보이고, 원격에 적용되지 않은 마이그레이션 목록이 나온다.

- [ ] **Step 2: 그룹 카테고리 이름 중복 확인(읽기, Review Focus 4)**

```sh
supabase db query --linked --password "$(cat ~/.config/nof-ledger/db_password)" \
  "select group_id, name, count(*) from categories where group_id is not null group by 1,2 having count(*) > 1"
```

(CLI에 `db query`가 없으면 Session pooler 주소로 `docker run --rm postgres:17-alpine psql`을 쓴다.) Expected: 0행. 행이 있으면 멈추고 사용자에게 보고한다.

- [ ] **Step 3: 적용 직전 백업**

```sh
mkdir -p ~/nof-ledger-backups && chmod 700 ~/nof-ledger-backups
supabase db dump --linked --password "$(cat ~/.config/nof-ledger/db_password)" -f ~/nof-ledger-backups/before-migrate-$(date +%F).sql
supabase db dump --linked --data-only --password "$(cat ~/.config/nof-ledger/db_password)" -f ~/nof-ledger-backups/before-migrate-$(date +%F)-data.sql
```

Expected: 파일 2개 생성(크기 확인). 백업 폴더는 저장소 밖.

- [ ] **Step 4: 적용**

```sh
supabase db push --linked --password "$(cat ~/.config/nof-ledger/db_password)"
supabase migration list --linked --password "$(cat ~/.config/nof-ledger/db_password)"
```

Expected: 모든 마이그레이션이 로컬·원격 양쪽에 표시. 실패하면 멈추고 보고(DB는 트랜잭션 단위로 이전 상태).

---

### Task 6: 클라우드 로그인 설정과 `.env.cloud` (운영, 승인 필요)

- [ ] **Step 1: `.env.cloud` 만들기(값 출력 없음)**

```sh
umask 077
ref=jmswewolwpjutohayrcf
keys=$(supabase projects api-keys --project-ref $ref -o json)
{
  echo "SUPABASE_URL=https://$ref.supabase.co"
  echo "SUPABASE_SERVICE_ROLE_KEY=$(printf '%s' "$keys" | node -e 'const k=JSON.parse(require("fs").readFileSync(0));process.stdout.write(k.find(x=>x.name==="service_role").api_key)')"
  echo "NEXT_PUBLIC_SUPABASE_URL=https://$ref.supabase.co"
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(printf '%s' "$keys" | node -e 'const k=JSON.parse(require("fs").readFileSync(0));process.stdout.write(k.find(x=>x.name==="anon").api_key)')"
} > .env.cloud
awk -F= '{print $1, length($2)}' .env.cloud; git check-ignore .env.cloud
```

Expected: 키 4개와 값 길이만 출력, `.env.cloud`가 git 제외로 표시.

- [ ] **Step 2: Auth 설정(Management API, 값 출력 없음)**

`ledger.<도메인>`은 사용자에게 받은 도메인으로 채운다(커밋하지 않음). Google 클라이언트 ID·비밀값은 로컬 설정 `supabase/.env`의 같은 OAuth 클라이언트 값을 쓴다.

```sh
# supabase login이 저장한 토큰: macOS 키체인 → 없으면 ~/.supabase/access-token. 값은 출력하지 않는다.
token=$(security find-generic-password -s "Supabase CLI" -w 2>/dev/null || cat ~/.supabase/access-token)
[ -n "$token" ] || { echo "토큰 없음: ! supabase login 필요"; exit 1; }
. ./supabase/.env                # SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID / _SECRET
curl -sf -X PATCH "https://api.supabase.com/v1/projects/jmswewolwpjutohayrcf/config/auth" \
  -H "Authorization: Bearer $token" -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({
    site_url: process.env.APP_URL,
    uri_allow_list: process.env.APP_URL + "/**",
    external_email_enabled: false,
    external_google_enabled: true,
    external_google_client_id: process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID,
    external_google_secret: process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET,
  }))')" -o /dev/null -w "%{http_code}\n"
```

(`APP_URL=https://ledger.<도메인>`을 이 명령에서만 환경으로 준다.) Expected: `200`. 다시 GET으로 `site_url`·`external_email_enabled`만 확인한다.

- [ ] **Step 3: Google Cloud Console 확인(Chrome)**

OAuth 클라이언트의 승인된 리디렉션 URI에 `https://jmswewolwpjutohayrcf.supabase.co/auth/v1/callback`이 있는지 확인하고, 없으면 추가한다(승인 후). 화면의 클라이언트 비밀값은 읽지 않는다.

---

### Task 7: 이미지 첫 빌드와 공개 (운영, 승인 필요)

- [ ] **Step 1: 저장소 변수**

```sh
set -a; . ./.env.cloud; set +a
gh variable set NEXT_PUBLIC_SUPABASE_URL --body "$NEXT_PUBLIC_SUPABASE_URL"
gh variable set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
gh variable list
```

- [ ] **Step 2: 태그 `v1.0.0`(승인 후)**

```sh
git tag -a v1.0.0 -m "첫 NAS 배포" && git push origin v1.0.0
gh run watch "$(gh run list --workflow image.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

Expected: 워크플로 성공.

- [ ] **Step 3: 패키지 공개**

```sh
gh api -X PATCH /user/packages/container/nof-payments-book/visibility -f visibility=public \
  || echo "API로 안 되면 Chrome에서 패키지 설정 > Change visibility > Public"
docker manifest inspect ghcr.io/vipuoow/nof-payments-book:v1.0.0 | grep -c amd64
```

Expected: 로그인 없이 manifest 조회 성공, amd64 포함. (`gh auth refresh -s write:packages`가 필요하면 사용자에게 요청.)

---

### Task 8: Cloudflare Tunnel (운영, 승인 필요)

- [ ] **Step 1: 네임서버 적용 확인(읽기)**

```sh
dig +short NS <도메인>
```

Expected: `*.ns.cloudflare.com` 2개. 아니면 기다린다.

- [ ] **Step 2: Tunnel 만들기(Chrome)**

Cloudflare 대시보드 → Zero Trust → Networks → Tunnels → [Create a tunnel] → Cloudflared → 이름 `nof-ledger` → 설치 화면의 토큰은 **화면에서 읽지 않고** Task 9에서 NAS `.env`에 붙여넣는다(복사 버튼 → 클립보드). 공개 호스트 이름: `ledger` . `<도메인>` → 서비스 `HTTP` `app:3000`.

- [ ] **Step 3: 확인(읽기)**

```sh
dig +short ledger.<도메인>
```

Expected: Cloudflare 주소가 나온다(Tunnel 연결 전이라 접속은 아직 안 됨).

---

### Task 9: NAS 설치와 실행 (운영, 승인 필요)

- [ ] **Step 1: Container Manager 설치·SSH 켜기(Chrome, DSM)**

DSM → 패키지 센터 → Container Manager 설치. 제어판 → 터미널 및 SNMP → SSH 서비스 활성화(포트는 사용자와 정함). 공유 폴더 `docker`가 생겼는지 확인하고 프로젝트 폴더 `<NAS 폴더>`(예: `/volume1/docker/nof-ledger`)를 정한다.

- [ ] **Step 2: SSH 키 등록**

이 Mac에서 `ssh-keygen -t ed25519 -f ~/.ssh/nof_nas -N ""`(키 출력 없음). 사용자가 `! ssh-copy-id -i ~/.ssh/nof_nas.pub -p <포트> <NAS 사용자>@<NAS 내부 주소>`로 비밀번호 1회 입력. `~/.ssh/config`에 `Host nof-nas` 항목 추가. 확인: `ssh nof-nas 'uname -m; sudo -n true 2>/dev/null && echo sudo-ok || echo sudo-needs-password'`.

- [ ] **Step 3: 파일 배치**

```sh
ssh nof-nas "mkdir -p <NAS 폴더>/backups && chmod 700 <NAS 폴더>"
scp deploy/compose.yaml deploy/backup.sh nof-nas:<NAS 폴더>/
# .env: 값은 이 Mac 파일에서 읽어 바로 보낸다(출력 없음). TUNNEL_TOKEN은 Task 8 클립보드에서.
{ set -a; . ./.env.cloud; set +a
  printf 'SUPABASE_URL=%s\nSUPABASE_SERVICE_ROLE_KEY=%s\nAPP_URL=https://ledger.<도메인>\nTYPESAFE_API_KEY=%s\nTUNNEL_TOKEN=%s\nBACKUP_DATABASE_URL=%s\n' \
    "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" "$(cat ~/.config/typesafe/api_key)" "$(pbpaste)" "<Session pooler 주소: 비밀번호는 ~/.config/nof-ledger/db_password>"
} | ssh nof-nas "umask 077 && cat > <NAS 폴더>/.env"
ssh nof-nas "awk -F= '{print \$1, length(\$2)}' <NAS 폴더>/.env; ls -l <NAS 폴더>/.env"
```

Expected: 키 6개와 길이, 권한 `-rw-------`. Session pooler 주소는 Supabase 대시보드(Connect)에서 형식을 확인하고 비밀번호 파일로 채운다.

- [ ] **Step 4: 실행**

```sh
ssh nof-nas "cd <NAS 폴더> && sudo docker compose pull && sudo docker compose up -d && sudo docker compose ps"
```

(Container Manager의 "프로젝트" 화면에서 같은 폴더로 등록되도록, DSM 화면에서 기존 폴더로 프로젝트 만들기를 쓰는 것이 낫다면 Chrome으로 진행하고 Ruling으로 남긴다.) Expected: 4개 서비스 `running`.

- [ ] **Step 5: 백업 한 번 실행**

```sh
ssh nof-nas "cd <NAS 폴더> && sudo docker compose run --rm -e RUN_ONCE=1 backup && ls -l backups"
```

Expected: 오늘 날짜 덤프 생성.

---

### Task 10: 확인과 문서 (운영 + 저장소)

- [ ] **Step 1: 외부 확인(읽기)**

```sh
curl -s https://ledger.<도메인>/api/health
```

Expected: `{"ok":true,"version":"<v1.0.0 커밋 앞 7자리>"}`.

- [ ] **Step 2: 사용 흐름(사용자와 함께)**

1. 사용자가 아이폰 Safari로 `https://ledger.<도메인>` → Google 로그인 → "초대받은 링크로 가입" 안내가 나오는지(프로필 없음) 확인.
2. `node --env-file=.env.cloud scripts/grant-operator.ts <사용자 이메일> <이름>`으로 운영자 지정(승인 후).
3. 다시 로그인 → 그룹 만들기 → 배우자 초대 링크 → 배우자 가입.
4. 두 사람 각자 `/devices`에서 아이폰 탭 → 토큰 발급 → 단축어 자동화 설정.
5. **잠긴 아이폰**으로 실제 결제(또는 국민카드 문자 수신) → 홈에 거래가 생기는지, jev 자동 분류가 붙는지 확인. 실패하면 단축어 실행 기록과 서버 로그(`docker compose logs app`)를 함께 보고 결과를 기록한다.
6. 홈 화면에 추가(PWA) → 앱처럼 열리는지.
7. 서버 액션(카테고리 변경)이 `ledger.<도메인>`에서 동작하는지(Review Focus 2).

- [ ] **Step 3: 자동 반영 확인**

작은 변경(예: 문서)을 승인 후 `v1.0.1` 태그 → 5분 안에 `/api/health`의 버전이 바뀌는지. `cloudflared`·`backup`·`watchtower` 컨테이너의 생성 시각이 그대로인지(Review Focus 5).

- [ ] **Step 4: 다음 날 백업·복구 시험**

NAS `backups/`에 KST 04:00 덤프가 생겼는지 확인 → 그 파일을 이 Mac으로 가져와 임시 Postgres(`docker run postgres:17-alpine`)에 `pg_restore`하고 `select count(*) from transactions`가 클라우드와 같은지 확인 → 임시 컨테이너·파일 삭제.

- [ ] **Step 5: 문서**

`docs/deploy/README.md`에 실제로 수행한 순서·명령·확인 방법을 `ledger.<도메인>`, `<NAS 폴더>` 자리 표시로 기록한다(재설치·되돌리기 포함). `docs/status.md`의 "현재 완료된 단계"를 갱신한다. 커밋 전 실제 도메인·IP·경로가 없는지 `grep`으로 확인.

```bash
git add docs/deploy docs/status.md
git commit -m "docs: NAS 배포 절차와 운영 상태 기록

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 범위 밖

- 기존 서비스 데이터 이전, 장애 알림, 갤럭시 실기기 확인
- 기존 Sites 서비스 종료(새 서비스 확인 후 사용자와 정함)
