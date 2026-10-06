# 가족 가계부 진행 현황 (이어서 작업하기)

최종 갱신: 2026-10-06

공개 저장소이므로 도메인·사이트 주소·NAS 접속 정보·네트워크 설정·비밀값은 이 문서에 쓰지 않는다. 주소는 `ledger.<도메인>`, NAS 폴더는 `<NAS 폴더>`로 쓴다.

## 1. 한눈에 보기

| 구분 | 상태 |
|---|---|
| 앱 기능 | **완료**: 문자 수신·분석, Google 로그인·초대, jev 자동 분류, 홈·거래 시트·직접 입력·미분류 문자, 예산·카테고리 관리·기기 연결 안내 |
| 배포(계획 4) | **진행 중**: Task 1~8 완료, NAS 설치(Task 9)·확인(Task 10) 남음 |
| 다음 할 일 | 계획 4 Task 9(NAS 설치·실행). NAS와 같은 네트워크(집)에서 진행 |

## 2. 완료한 계획

| 계획 | 문서 | 내용 |
|---|---|---|
| 1 백엔드 핵심 | `docs/superpowers/plans/2026-10-01-backend-core.md` | DB·RLS, 국민카드 분석기, `POST /api/ingest` |
| 2 인증·초대 | `docs/superpowers/plans/2026-10-01-auth-invites.md` | Google 로그인, 운영자→그룹장→배우자 초대, 기기 토큰 |
| jev 자동 분류 | `docs/superpowers/plans/2026-10-02-jev-category.md` | TypeSafe(jev)로 미지정 거래 카테고리 분류, 출처(rule/ai/user) |
| 3-1 핵심 화면 | `docs/superpowers/plans/2026-10-02-screens-core.md` | 홈(합계+월별 거래), 거래 시트(카테고리 학습), 직접 입력, 미분류 문자, PWA, Playwright |
| 3-2 관리 화면 | `docs/superpowers/plans/2026-10-02-screens-more.md` | 매달 이어지는 예산, 카테고리 숨김·관리, 아이폰/갤럭시 기기 연결 안내 |

설계 문서는 `docs/superpowers/specs/`에 있다. 통계 화면과 기존 서비스 데이터 이전은 사용자 결정으로 하지 않는다.

**테스트(2026-10-02 기준)**: 단위 74, DB 79, 화면(Playwright) 29, 배포 묶음 테스트 모두 통과.

## 3. 계획 4 (NAS 배포) 진행 상황

계획: `docs/superpowers/plans/2026-10-02-deploy-nas.md`, 설계: `docs/superpowers/specs/2026-10-02-deploy-nas-design.md`

**정한 것**: Cloudflare Tunnel(포트 개방 없음), 닷네임에서 산 도메인을 Cloudflare 네임서버로 연결해 `ledger.<도메인>` 사용, 모든 단계를 Claude가 수행(로그인·비밀번호 입력만 사용자), `v*` 태그를 붙이면 GitHub Actions가 amd64 이미지를 GHCR(공개)에 올리고 NAS의 Watchtower(`nickfedor/watchtower`)가 자동 반영, NAS가 매일 KST 04:00에 DB 백업(30일 보관), 기존 데이터는 옮기지 않음.

| Task | 상태 | 메모 |
|---|---|---|
| 1 `/api/health`·이미지 빌드 인자 | 완료 | 이미지 안에 비밀값 없음 확인 |
| 2 GitHub Actions 이미지 빌드 | 완료 | 태그를 붙여야 실행된다(아직 태그 없음) |
| 3 NAS 묶음(`deploy/`) | 완료 | compose·백업 스크립트·환경 견본 |
| 4 새 DB 마이그레이션 확인 | 완료 | `sh scripts/verify-fresh-migrations.sh` — 11개 적용, test:db 통과 |
| 5 클라우드 DB 적용 | 완료 | 2026-10-06, 마이그레이션 11개 적용, 적용 전 백업은 작업한 Mac에 보관 |
| 6 `.env.cloud`·Auth 설정 | 완료 | 사이트 주소 `https://ledger.<도메인>`, 이메일 로그인 끔, Google 켬 |
| 7 태그 `v1.0.0`·이미지 공개 | 완료 | GHCR 공개, amd64 확인 |
| 8 Cloudflare Tunnel | 완료 | 터널 `nof-ledger`(작업한 Mac의 `cloudflared`로 생성), `ledger.<도메인>` 연결 |
| 9 NAS 설치·실행 | **다음** | 시작 전 NAS의 `docker version`·`docker compose version` 확인(DSM 7.1이면 Compose v1일 수 있음) |
| 10 확인·문서 | 남음 | 잠긴 아이폰 문자 전송 확인, 백업 복구 시험, `docs/deploy/README.md` 작성 |

**Task 9 메모**

- 터널 연결 열쇠(`TUNNEL_TOKEN`)는 작업한 Mac에서 `cloudflared tunnel token nof-ledger`로 꺼내 NAS `.env`에 바로 넣는다(화면 출력 금지). 다른 컴퓨터에서 하려면 그 컴퓨터에서 `cloudflared tunnel login` 후 같은 명령을 쓴다.
- DB 비밀번호 파일(`~/.config/nof-ledger/db_password`)과 `.env.cloud`는 작업한 Mac에만 있다(4.2).

## 4. 다른 컴퓨터(집)에서 이어서 하기

### 4.1 개발 환경

```sh
git clone https://github.com/vipuoow/nof-payments-book.git && cd nof-payments-book
corepack enable && pnpm install
git config core.hooksPath .githooks        # 커밋 전 비밀값 검사(gitleaks 필요)
brew install supabase/tap/supabase gitleaks
# Docker Desktop 실행 후
supabase start
./scripts/write-test-env.sh && cp .env.test.local .env.local
pnpm exec playwright install webkit
pnpm test && pnpm test:db && pnpm test:e2e  # 모두 통과하면 준비 끝
```

### 4.2 git에 없는 파일 (직접 옮기거나 다시 만든다)

GitHub로 옮기지 않는다. 필요한 컴퓨터에서 다시 만들거나 안전한 방법(직접 복사)으로 옮긴다.

| 파일 | 용도 | 없을 때 |
|---|---|---|
| `supabase/.env` | 로컬 Google 로그인(OAuth 클라이언트 ID·비밀값) | 로컬에서 Google 로그인 불가. 테스트는 통과 |
| `~/.config/typesafe/api_key`(600) + `~/.zshenv`의 `TYPESAFE_API_KEY` 줄 | jev 분류 | 분류를 건너뜀(앱은 정상) |
| `~/.config/nof-ledger/db_password`(600) | 클라우드 DB 비밀번호 | Task 5~ 진행 불가 |
| `.env.cloud`(600) | 클라우드 접속값(운영자 지정 스크립트 등) | Task 6에서 다시 만든다 |
| `~/.ssh/nof_nas` | NAS SSH 키(Task 9에서 생성 예정) | 그 컴퓨터에서 새로 만들어 등록 |

커밋 전 검사(`.githooks/pre-commit`)는 이 파일들이 있는 컴퓨터에서만 실제 키 값 대조를 한다. 키 파일이 없는 컴퓨터에서는 gitleaks 검사만 한다.

### 4.3 Claude와 이어서 작업할 때 (작업 원칙)

Claude Code의 메모리는 컴퓨터마다 따로라 아래 원칙을 새 대화 시작 때 알려 준다(또는 이 문서를 읽게 한다).

- 모든 답변은 한국어로.
- 무엇이든 실행하기 전에 단계별로 승인받는다. 상태 확인(읽기)과 변경을 구분한다. 커밋·push도 승인 후.
- 키·비밀값 파일을 GitHub에 올리지 않는다. 커밋·push 전 포함 여부를 확인한다(gitleaks는 이름 없이 값만 있는 키를 놓칠 수 있음).
- 비밀값은 화면·대화에 출력하지 않는다(길이·존재 여부로만 확인).
- "jev" = TypeSafe(typesafe.ai) API, 키 환경변수는 `TYPESAFE_API_KEY`.
- 로컬 DB에 `supabase db reset`을 쓰지 않는다(마이그레이션은 `supabase migration up --local`).
- 계획 진행 방식: superpowers 스킬(설계 → 계획 → 이 대화에서 직접 구현 → 별도 검토자 최종 검토 → 승인 후 커밋).

## 5. 기존 서비스와 NAS

- 기존 서비스(Sites)는 새 서비스가 확인될 때까지 유지하고, 종료 시점은 나중에 정한다.
- NAS: Synology DS920+, DSM 7.1 계열, Intel J4125(amd64), 메모리 4GB. Docker(Container Manager) 미설치, 외부 주소 없음(2026-10-01 읽기 전용 확인).
