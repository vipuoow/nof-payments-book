# 가족 가계부 진행 현황 (이어서 작업하기)

최종 갱신: 2026-10-08 (거래 상세·새로 추가·밀어서 삭제·확인할 문자 v1.3.0)

공개 저장소이므로 도메인·사이트 주소·NAS 접속 정보·네트워크 설정·비밀값은 이 문서에 쓰지 않는다. 주소는 `ledger.<도메인>`, NAS 폴더는 `<NAS 폴더>`로 쓴다.

## 1. 한눈에 보기

| 구분 | 상태 |
|---|---|
| 앱 기능 | **완료**: 문자 수신·분석, Google 로그인·초대, jev 자동 분류, 홈·거래 시트·직접 입력·미분류 문자, 예산·카테고리 관리·기기 연결 안내 |
| 배포(계획 4) | **완료**: NAS에서 서비스 실행 중, 잠긴 아이폰 자동 기록·자동 교체·백업 되살리기 확인 (2026-10-07) |
| 디자인 1차 | **완료·배포(v1.1.0)**: 같이가계부 이름·색, 처음 화면 배경 영상, 닉네임·파트너 초대, 처음 홈 3단계(연결·한도), 한도 바꾸기, 휴대폰 연결 단계별 안내, 홈(쓴 카드). 설계 `docs/superpowers/specs/2026-10-07-design-v1-design.md` |
| 카드사 | 국민카드, 현대카드(v1.0.5). 취소 짝 짓기는 카드사가 같아야 함 |
| 2026-10-08 | 앱 안 브라우저 안내(v1.1.1), 운영자 화면(v1.2.0), 온누리상품권 표시(v1.2.1), 거래 화면 새 디자인(v1.3.0). 아래 7절 |
| 다음 할 일 | 카테고리 관리 설계, 금액 없는 국민카드 안내·광고 문자 자동 무시 여부 결정, Google 직접 로그인 켜기(아래 6절) |

## 2. 완료한 계획

| 계획 | 문서 | 내용 |
|---|---|---|
| 1 백엔드 핵심 | `docs/superpowers/plans/2026-10-01-backend-core.md` | DB·RLS, 국민카드 분석기, `POST /api/ingest` |
| 2 인증·초대 | `docs/superpowers/plans/2026-10-01-auth-invites.md` | Google 로그인, 운영자→그룹장→배우자 초대, 기기 토큰 |
| jev 자동 분류 | `docs/superpowers/plans/2026-10-02-jev-category.md` | TypeSafe(jev)로 미지정 거래 카테고리 분류, 출처(rule/ai/user) |
| 3-1 핵심 화면 | `docs/superpowers/plans/2026-10-02-screens-core.md` | 홈(합계+월별 거래), 거래 시트(카테고리 학습), 직접 입력, 미분류 문자, PWA, Playwright |
| 3-2 관리 화면 | `docs/superpowers/plans/2026-10-02-screens-more.md` | 매달 이어지는 예산, 카테고리 숨김·관리, 아이폰/갤럭시 기기 연결 안내 |

설계 문서는 `docs/superpowers/specs/`에 있다. 통계 화면과 기존 서비스 데이터 이전은 사용자 결정으로 하지 않는다.

**테스트(2026-10-07 기준)**: 단위 77, DB 80, 화면(Playwright) 30, 배포 묶음 테스트 모두 통과.

## 3. 계획 4 (NAS 배포) 진행 상황

계획: `docs/superpowers/plans/2026-10-02-deploy-nas.md`, 설계: `docs/superpowers/specs/2026-10-02-deploy-nas-design.md`

**정한 것**: Cloudflare Tunnel(포트 개방 없음), 닷네임에서 산 도메인을 Cloudflare 네임서버로 연결해 `ledger.<도메인>` 사용, 모든 단계를 Claude가 수행(로그인·비밀번호 입력만 사용자), `v*` 태그를 붙이면 GitHub Actions가 amd64 이미지를 GHCR(공개)에 올리고 NAS의 Watchtower(`nickfedor/watchtower`)가 자동 반영, NAS가 매일 KST 04:00에 DB 백업(30일 보관), 기존 데이터는 옮기지 않음.

| Task | 상태 | 메모 |
|---|---|---|
| 1 `/api/health`·이미지 빌드 인자 | 완료 | 이미지 안에 비밀값 없음 확인 |
| 2 GitHub Actions 이미지 빌드 | 완료 | 태그를 붙여야 실행된다(아직 태그 없음) |
| 3 NAS 묶음(`deploy/`) | 완료 | compose·백업 스크립트·환경 견본 |
| 4 새 DB 마이그레이션 확인 | 완료 | `sh scripts/verify-fresh-migrations.sh` — 11개 적용, test:db 통과 |
| 5 클라우드 DB 적용 | 완료 | 2026-10-06, 마이그레이션 11개 적용, 적용 전 백업은 2026-10-07에 삭제(NAS 매일 백업으로 대체) |
| 6 `.env.cloud`·Auth 설정 | 완료 | 사이트 주소 `https://ledger.<도메인>`, 이메일 로그인 끔, Google 켬 |
| 7 태그 `v1.0.0`·이미지 공개 | 완료 | GHCR 공개, amd64 확인 |
| 8 Cloudflare Tunnel | 완료 | 터널 `nof-ledger`(작업한 Mac의 `cloudflared`로 생성), `ledger.<도메인>` 연결 |
| 9 NAS 설치·실행 | 완료 | 2026-10-06. app·cloudflared·watchtower·backup 4개 실행, `https://ledger.<도메인>/api/health` 응답, 첫 백업 파일 생성 |
| 10 확인·문서 | 완료 | 2026-10-07. 아래 "Task 10 결과" |

**Task 9에서 알게 된 것(NAS 환경)**

- NAS는 회사에 있고 Tailscale로 원격 관리한다. SSH는 관리용 일반 계정 + 키 로그인, `sudo` 비밀번호 없이 쓸 수 있는 것은 `docker`·`docker-compose` 두 개뿐이다(sudoers 규칙).
- DSM 7.1.1의 Docker 패키지는 Docker 20.10.3, **docker-compose 1.28.5**다. 그래서
  - `compose.yaml`의 최상위 `name:`을 빼고 묶음 이름은 `.env`의 `COMPOSE_PROJECT_NAME=nof-ledger`로 정한다.
  - 1.x는 `compose.yaml`을 자동으로 찾지 못하므로 항상 `docker-compose -f compose.yaml ...`로 실행한다.
  - `docker-compose run`은 sudo 환경에서 `docker` 경로를 못 찾아 실패한다. 한 번 실행은 `docker exec`를 쓴다.
- NAS의 SFTP가 꺼져 있어 `scp`가 실패한다. 파일은 `ssh <NAS> "cat > <NAS 폴더>/파일" < 파일`로 올린다.
- NAS `.env`(600)가 운영값의 기준이다(Supabase 주소·서비스 키, 사이트 주소, jev 키, 터널 열쇠, 백업 DB 주소). Mac의 `.env.cloud`·DB 비밀번호 파일은 2026-10-07에 삭제했다.
- NAS에 Hyper Backup이 설치돼 있지 않다. 백업 파일은 NAS `<NAS 폴더>/backups`에만 있다(필요하면 Hyper Backup으로 다른 곳에 사본을 둔다).

**자주 쓰는 운영 명령(NAS에서, `<NAS 폴더>` 안)**

```sh
sudo docker-compose -f compose.yaml ps                       # 상태
sudo docker-compose -f compose.yaml logs --tail 50 app       # 앱 기록
sudo docker-compose -f compose.yaml pull && sudo docker-compose -f compose.yaml up -d   # 수동 갱신
sudo docker exec -e RUN_ONCE=1 nof-ledger_backup_1 sh /backup.sh                       # 지금 백업
```

**Task 10 결과 (2026-10-07)**

- 운영자 지정(운영자 계정 1개), 아이폰 구글 로그인, 그룹 만들기 완료. 배우자 초대는 아직 안 함(지금은 한 명이 사용).
- 기기 연결이 어렵다는 의견으로 아이폰 연결 방식을 바꿈: 미리 만든 단축어 받기 + 연결 코드 붙여넣기 + 자동화(v1.0.1~v1.0.3). 본문이 빈 요청은 '연결 확인'으로 처리.
- **잠긴 아이폰에서 국민카드 결제 → 자동 기록 확인.** 처음 보는 가맹점이라 AI가 확신하지 못해 미분류로 남음(설계대로).
- 자동 교체: 태그 후 약 3분 안에 NAS가 새 판으로 바꿈(3회 확인).
- 백업: 새벽 04:00 자동 백업 생성 확인, 빈 DB에 되살리기 시험 통과(`supabase_vault` 오류 3줄만, 무시해도 됨).
- 홈 거래 목록에 결제 시각(시:분) 표시 추가.
- Mac의 `.env.cloud`·DB 비밀번호 파일 삭제. 운영값은 NAS `.env`가 기준(`docs/deploy/README.md` 8절).
- 배포·운영 문서: `docs/deploy/README.md`

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
| (클라우드 접속값) | 운영자 지정 스크립트 등 | Mac에 두지 않는다. NAS `.env`에서 그때그때 읽는다(`docs/deploy/README.md` 8절) |
| `~/.ssh/nof_nas` + `~/.ssh/config`의 NAS 항목 | NAS SSH 키 로그인 | 4.3대로 그 컴퓨터에서 새 키를 만들어 등록 |

커밋 전 검사(`.githooks/pre-commit`)는 이 파일들이 있는 컴퓨터에서만 실제 키 값 대조를 한다. 키 파일이 없는 컴퓨터에서는 gitleaks 검사만 한다.

### 4.3 NAS 원격 관리(다른 컴퓨터에서)

1. 그 컴퓨터에 Tailscale을 설치하고 같은 계정으로 로그인한다(관리 화면에서 NAS가 보이는지 확인, NAS는 키 만료 끔).
2. 새 SSH 키를 만든다: `ssh-keygen -t ed25519 -f ~/.ssh/nof_nas -N ""`
3. 공개키를 NAS 관리용 계정의 `~/.ssh/authorized_keys`에 추가한다(처음 한 번은 그 계정 비밀번호로 `ssh-copy-id -i ~/.ssh/nof_nas.pub <계정>@<NAS Tailscale 주소>`).
4. `~/.ssh/config`에 `Host nof-nas`(HostName = NAS Tailscale 주소, User, IdentityFile ~/.ssh/nof_nas, IdentitiesOnly yes)를 넣고 `ssh nof-nas`로 확인한다.
5. 운영값이 필요하면 NAS `.env`를 기준으로 쓴다(화면에 출력하지 말 것). 예: 운영자 지정 스크립트용 값은 NAS `.env`의 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`.

### 4.4 Claude와 이어서 작업할 때 (작업 원칙)

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

## 6. 디자인 1차 (v1.1.0, 2026-10-07)

계획: `docs/superpowers/plans/2026-10-07-design-v1.md`, 설계: `docs/superpowers/specs/2026-10-07-design-v1-design.md`

- 클라우드 DB에 `20261007010000_design_v1` 적용(적용 전 NAS 백업). NAS `compose.yaml`은 새 판으로 바꿨다(이전 판 `compose.yaml.bak-v1.0.5`). `media/`에 영상(1.36MB, 716×1280 H.264)과 멈춘 그림을 넣었다.
- 처음 홈 단계: 가계부 연결(구성원 누구든 문자가 한 번이라도 왔거나 거래가 있음) → 전체 한도(필수) → 평소 홈. 내 휴대폰이 지금 연결 전이면 홈 위에 알림.
- **Google 직접 로그인은 아직 꺼져 있다**(지금은 리디렉트 방식). 켜려면:
  1. Google Cloud 콘솔의 OAuth 클라이언트에 "승인된 JavaScript 원본"으로 `https://ledger.<도메인>`(로컬은 `http://127.0.0.1:3100`)을 추가한다.
  2. Supabase 대시보드 → Authentication → Google의 허용 클라이언트 ID(Authorized Client IDs)에 같은 클라이언트 ID가 있는지 확인한다.
  3. NAS `.env`에 `GOOGLE_CLIENT_ID=<클라이언트 ID>`를 넣고 `sudo docker-compose -f compose.yaml up -d app`.
  4. 휴대폰에서 로그인해 보고, 안 되면 `.env`에서 값을 지우고 같은 명령으로 되돌린다.
- 영상 바꾸기: `docs/deploy/README.md` 6-1절.
- 미룬 작은 점: `/media` 이름 확인을 `Object.hasOwn`으로, 길이 0 영상이면 500, GIS 1회용 값 쿠키가 하나·5분이고 준비 실패 시 대체 버튼 없음, 예전 초대(닉네임 없음)를 기존 프로필 사용자가 받으면 Google 이름으로 덮어씀, 일반 구성원이 구성원 목록을 볼 곳 없음.

## 7. 거래 화면 새 디자인 (v1.3.0, 2026-10-08)

계획: `docs/superpowers/plans/2026-10-08-tx-screens.md`, 설계: `docs/superpowers/specs/2026-10-08-tx-screens-design.md`

- 거래 상세: 줄을 누르면 화면 전체로 커지고, 닫으면 하수구처럼 그 줄로 빨려 들어가 파문·반짝. 카드 문자 거래는 분류와 온누리 체크만, 직접 추가한 거래는 모든 항목을 한 화면씩 고친다. 메모·원문 보기는 없앴다(DB의 메모 칸은 남김).
- 새로 추가(+): 금액 → 어디서 → 분류 → 언제 → 누가를 한 칸씩 묻고 답이 위에 쌓인다. 금액은 입력하는 즉시 한글 단위(13325 → 1만 3325).
- 밀어서 삭제: 직접 추가한 줄만, 확인 창 뒤 삭제. 카드 문자 줄은 지울 수 없다고 알림.
- 확인할 문자: 홈 위에 겹쳐 뜬다. [거래로 등록]은 문자에서 찾은 금액·가게·시각·받은 사람을 미리 채우고 빠진 것만 묻는다.
- 겹쳐 뜨는 화면은 주소(`?tx=`·`?add=1`·`?inbox=1`)로 열고 휴대폰 '뒤로'로 닫힌다. 예전 주소 `/new`·`/unparsed`는 새 화면으로 보낸다.
- 서버 검사: `src/ledger/tx-edit.ts`(카드 거래 수정·삭제 거절, 문자는 먼저 차지해서 둘이 동시에 등록해도 하나만). DB에도 같은 규칙을 걸었다(`20261008020000_card_tx_guard`: 카드 거래의 금액·가게·일시·사람 변경과 삭제를 거절).
- 직접 추가한 거래는 상세의 "이 거래 지우기"로도 지운다(밀기를 못 쓰는 경우). 열린 거래를 다른 달로 옮기거나 지우면 상세가 바로 닫힌다.

