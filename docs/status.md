# 가족 가계부 진행 현황 (이어서 작업하기)

최종 갱신: 2026-10-08 밤 (화면 모드·한도 카드 v1.4.0 배포 완료 — 아래 8절)

공개 저장소이므로 도메인·사이트 주소·NAS 접속 정보·네트워크 설정·비밀값은 이 문서에 쓰지 않는다. 주소는 `ledger.<도메인>`, NAS 폴더는 `<NAS 폴더>`로 쓴다.

## 1. 한눈에 보기

| 구분 | 상태 |
|---|---|
| 앱 기능 | **완료**: 문자 수신·분석, Google 로그인·초대, jev 자동 분류, 홈·거래 시트·직접 입력·미분류 문자, 예산·카테고리 관리·기기 연결 안내 |
| 배포(계획 4) | **완료**: NAS에서 서비스 실행 중, 잠긴 아이폰 자동 기록·자동 교체·백업 되살리기 확인 (2026-10-07) |
| 디자인 1차 | **완료·배포(v1.1.0)**: 같이가계부 이름·색, 처음 화면 배경 영상, 닉네임·파트너 초대, 처음 홈 3단계(연결·한도), 한도 바꾸기, 휴대폰 연결 단계별 안내, 홈(쓴 카드). 설계 `docs/superpowers/specs/2026-10-07-design-v1-design.md` |
| 카드사 | 국민카드, 현대카드(v1.0.5). 취소 짝 짓기는 카드사가 같아야 함 |
| 2026-10-08 | 앱 안 브라우저 안내(v1.1.1), 운영자 화면(v1.2.0), 온누리상품권 표시(v1.2.1), 거래 화면 새 디자인(v1.3.0), 화면 모드·한도 카드(v1.4.0). 아래 7·8절 |
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

### 4.1 개발 환경 (Mac · Windows WSL2 공통)

두 컴퓨터가 같은 버전을 쓰도록 저장소에 고정해 두었다: Node는 `.node-version`(26.7.0), pnpm은 `package.json`의 `packageManager`, Supabase CLI는 개발 의존성(2.119.0, `pnpm exec supabase`), gitleaks는 `scripts/setup-dev.sh`(8.30.1). 줄바꿈은 `.gitattributes`로 LF 고정.

- `pnpm dev:setup`: 설치 → 로컬 Supabase 시작·마이그레이션 → 환경 파일 → webkit → 점검. 여러 번 실행해도 된다. `sh scripts/setup-dev.sh --test`는 테스트까지.
- `pnpm dev:doctor`: 버전·필수 파일 점검만(✅ 맞음 · ⚠️ 없어도 개발은 됨 · ❌ 고쳐야 함).

**Mac**

```sh
brew install node git    # node 버전이 .node-version과 다르면 fnm 사용
git clone https://github.com/vipuoow/nof-payments-book.git && cd nof-payments-book
# Docker Desktop 실행 후
sh scripts/setup-dev.sh --test
```

**Windows (집): WSL2 Ubuntu 안에서 개발한다.** PowerShell·`C:` 드라이브에서 하지 않는다(스크립트·줄바꿈·속도 문제).

1. Docker Desktop › Settings › Resources › WSL integration에서 쓰는 Ubuntu를 켠다(General의 "Use the WSL 2 based engine"도 켬).
2. Ubuntu 터미널에서:

```sh
sudo apt update && sudo apt install -y git curl unzip
curl -fsSL https://fnm.vercel.app/install | bash && exec $SHELL   # Node 버전 관리(.node-version을 읽는다)
mkdir -p ~/dev && cd ~/dev                                          # /mnt/c 아래에 두지 않는다
git clone https://github.com/vipuoow/nof-payments-book.git && cd nof-payments-book
git config --global core.autocrlf input
sh scripts/setup-dev.sh --test     # webkit 라이브러리 설치 때 sudo 비밀번호를 물을 수 있다
```

3. 브라우저는 Windows 쪽에서 `http://127.0.0.1:3100`(앱), Supabase Studio는 `http://127.0.0.1:54323`으로 열린다(WSL2가 주소를 Windows와 공유).
4. 편집기는 VS Code + "WSL" 확장으로 Ubuntu 안의 폴더를 연다. Claude Code도 Ubuntu 터미널에서 실행한다.

### 4.2 git에 없는 파일 (직접 옮기거나 다시 만든다)

GitHub로 옮기지 않는다. 필요한 컴퓨터에서 다시 만들거나 안전한 방법(직접 복사)으로 옮긴다.

| 파일 | 용도 | 없을 때 |
|---|---|---|
| `supabase/.env` | 로컬 Google 로그인(OAuth 클라이언트 ID·비밀값) | 로컬에서 Google 로그인 불가. 테스트는 통과 |
| `~/.config/typesafe/api_key`(600) + 셸 설정(Mac `~/.zshenv`, WSL `~/.bashrc`)의 `TYPESAFE_API_KEY` 줄 | jev 분류 | 분류를 건너뜀(앱은 정상) |
| (클라우드 접속값) | 운영자 지정 스크립트 등 | Mac에 두지 않는다. NAS `.env`에서 그때그때 읽는다(`docs/deploy/README.md` 8절) |
| `~/.ssh/nof_nas` + `~/.ssh/config`의 NAS 항목 | NAS SSH 키 로그인 | 4.3대로 그 컴퓨터에서 새 키를 만들어 등록 |

커밋 전 검사(`.githooks/pre-commit`)는 이 파일들이 있는 컴퓨터에서만 실제 키 값 대조를 한다. 키 파일이 없는 컴퓨터에서는 gitleaks 검사만 한다.

### 4.3 NAS 원격 관리(다른 컴퓨터에서)

1. 그 컴퓨터에 Tailscale을 설치하고 같은 계정으로 로그인한다(관리 화면에서 NAS가 보이는지 확인, NAS는 키 만료 끔). Windows는 Windows용 Tailscale을 설치하면 WSL 안에서도 NAS에 닿는다(안 닿으면 WSL 안에도 Tailscale 설치). 아래 SSH 단계는 WSL Ubuntu 안에서 한다.
2. 새 SSH 키를 만든다: `ssh-keygen -t ed25519 -f ~/.ssh/nof_nas -N ""`
3. 공개키를 NAS 관리용 계정의 `~/.ssh/authorized_keys`에 추가한다(처음 한 번은 그 계정 비밀번호로 `ssh-copy-id -i ~/.ssh/nof_nas.pub <계정>@<NAS Tailscale 주소>`).
4. `~/.ssh/config`에 `Host nof-nas`(HostName = NAS Tailscale 주소, User, IdentityFile ~/.ssh/nof_nas, IdentitiesOnly yes)를 넣고 `ssh nof-nas`로 확인한다.
5. 운영값이 필요하면 NAS `.env`를 기준으로 쓴다(화면에 출력하지 말 것). 예: 운영자 지정 스크립트용 값은 NAS `.env`의 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`.

### 4.4 Claude와 이어서 작업할 때 (작업 원칙)

Claude Code의 메모리는 컴퓨터마다 따로라 아래 원칙을 새 대화 시작 때 알려 준다(또는 이 문서를 읽게 한다). Mac의 메모리 폴더(`~/.claude/projects/<작업 폴더 이름>/memory/`)를 직접 복사해 가도 된다(가계부 주소 등이 들어 있어 GitHub에는 올리지 않는다).

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

## 8. 화면 모드 · 한도 카드 (v1.4.0 배포 완료, 2026-10-08)

설계: `docs/superpowers/specs/2026-10-08-theme-limit-card-design.md`, 시안 23~33판(Claude 시안 페이지).

**한 것**
- 화면 모드(사람마다): 기본(흰색→라벤더, 보라 강조) · 밝게 · 어둡게. `profiles.theme` + 쿠키 `theme`, 메뉴 › 화면 모드(`/settings/theme`). 기기 설정 따르기는 넣지 않음(사용자 결정).
- 한도 카드 B안: 한도 → 쓴 돈(50% 이하 녹색 · 85% 미만 노랑 · 85% 이상 빨강) → 사람별(`|`) → 굵은 막대 안 남은 돈, 10% 미만이면 문구(거의 다 썼어요 / 다 썼어요 / 우리 다음 달을 생각해요 / 130% 이상 슬픈 결제일이 될 것 같아요). 카드를 옆으로 밀면 달이 바뀜.
- 이동 링크는 아이콘만(한도 카드 "‹ 9월"은 유지), 닫기는 큰 X, 입력 버튼은 줄어들며 ✓ + 빛이 번진 뒤 넘어감, 확인할 문자 줄은 깜빡이는 보라 점.
- 별도 검토 반영(커밋 `2bc943a`, 테스트 `e2e/limit-card-fixes.spec.ts`): 달 넘김 뒤 카드가 사라지던 것, 카드 밖에서 놓아도 계속 끌리던 것, 끈 뒤 키보드 달 링크, Enter도 체크 버튼 경로로(두 번 저장 막음), 저장 중 `aria-busy`, 연결 끊김 안내, 긴 남은 금액은 막대 안쪽, 어둡게 모드 막대 글자 진하게, 초대 전 계정 로그아웃 때 `theme` 쿠키 삭제, 항목 저장 중 온누리 체크 막음. "한도 0이면 '한도 원 중'"은 `effectiveBudgets`가 0을 이미 빼서 실제로는 생기지 않음(카드 조건만 맞춤).
- 테스트: 단위 148 · DB 117 · 화면 63 · 배포 묶음 · lint · tsc 통과. 화면 테스트 첫 전체 실행 때 "+로 새로 추가" 1개가 한 번 실패했으나 이후 반복(45회·전체 63) 모두 통과 — 다시 보이면 살펴본다.

**배포(2026-10-08 밤)**: NAS 지금 백업(`ledger-2026-10-08.dump`, 그날 04:00 파일을 덮어씀) → 운영 DB에 `20261008030000_profile_theme` 미리 보기·적용(마이그레이션 17개 일치) → `v1.4.0` 태그 → 자동 교체, `/api/health` `2bc943a`, 사용량 제한 그대로 확인.
- 운영 DB 적용은 NAS `.env`의 `BACKUP_DATABASE_URL`로 한다(화면에 출력하지 않음): `supabase db push --db-url "$DBURL" --dry-run` → 같은 명령에서 `--dry-run` 빼고 `--yes`.
- NAS의 `sudo`는 전체 경로(`/usr/local/bin/docker`, `/usr/local/bin/docker-compose`)로 써야 비밀번호 없이 된다.
- Claude Code 자동 승인은 NAS에서 쓰는 명령·운영 DB 적용·태그 올리기를 막는다. 이때는 사용자가 `! 명령`으로 직접 실행한다.

**Notion**: "결제문자 가지고놀기"에 "7. 지금까지 달라진 것"(v1.0~v1.4, 다음 할 일)을 더하고, "설정 따라하기" 4절에 NAS `sudo` 전체 경로·운영 DB 적용·자동 승인이 막을 때 `! 명령`으로 하는 법을 더함(2026-10-08).

**v1.4.1(2026-10-08 밤)**: 휴대폰에서 한도 카드를 손가락으로 밀어도 달이 안 넘어가던 문제. 손가락은 처음 닿은 안쪽 요소에 묶여 있다가 카드가 잡기를 가져가면 그 요소의 `lostpointercapture`가 카드까지 올라오는데, 이를 끌기 끝으로 처리했다(v1.4.0의 검토 반영에서 생김, 마우스 테스트로는 안 보임). 카드 자신의 것만 보도록 고침, 재현 테스트 추가. `/api/health` `66b11a3` 확인.

**v1.4.2(2026-10-08 밤)**: 휴대폰에서 밀어 보니 움직임이 어색하고(카드가 투명해진 뒤 빈칸, 덜 밀면 툭 튐, 목록은 이전 달 그대로) 기다리는 표시가 없었다. 사용자가 "카드 유지 + 자리표시"를 골랐다. 손을 떼면 카드가 가운데로 미끄러져 돌아오고 달 이름은 바로 바뀌며, 새 달 데이터를 받는 동안 카드 숫자·막대와 아래 예산·목록 자리에 반짝이는 자리표시(`month-switch.tsx`: `useTransition` + `router.push`, 목록은 숨겨 두어 상태 유지). 테스트 `e2e/month-switch.spec.ts`(서버 응답을 1.5초 늦춰 확인). `/api/health` `ad66271`.

**남은 일**: 휴대폰에서 화면 모드·한도 카드 밀기(v1.4.2) 직접 확인.

**미뤄 둔 것**: 카테고리 관리(22판 시안 확인 대기), 많은 거래 로딩 화면, 운영 이미지 Node 24 ↔ 개발 26 맞추기.

## 9. + 버튼 펼침 · 문자 붙여넣기 (v1.5.0 배포 완료 — 2026-10-08 밤)

설계: `docs/superpowers/specs/2026-10-08-add-paste-design.md`, 계획: `docs/superpowers/plans/2026-10-08-add-paste.md`

- 홈 +: 누르면 ×로 돌며 [결제 직접 입력]이 펼쳐지고 3초 뒤(또는 ×·바깥) 접힌다(`add-button.tsx`).
- 새로 추가 맨 앞 분기: 카드 문자 붙여넣기 / 직접 적기(`add-choice.tsx`). 확인할 문자의 [거래로 등록]은 분기 없이 간다.
- 붙여넣기(`paste-step.tsx`, `src/ledger/paste-sms.ts`): 국민·현대 분석기 → 문자 짐작 순으로 금액·가게·시각, 누가 = 나, 분류는 우리 가계부 가맹점 규칙(이름이 같을 때). 빠진 것만 묻고 마지막 화면. 취소 문자(모르는 카드사도 "취소"가 있으면)·금액 없음·빈 칸은 안내. 원문은 서버로 보내지 않는다.
- 저장은 직접 추가 거래. 붙여넣기 저장만 겹침 확인(같은 사람·금액·앞뒤 5분, 취소 제외) → "이미 들어온 결제 같아요" + [그래도 저장]/[닫기] (`src/ledger/overlap.ts`, `createManualTx`의 `checkOverlap`).
- 테스트: 단위 157 · DB 122 · 화면 74 · 배포 묶음 · lint · tsc 통과. DB 구조 변경 없음.
- 별도 검토(opus): 중요 2건 고침(그래도 저장 두 번 저장, 키보드로 머물 때 접힘). 미룬 작은 것: Esc로 접기 없음, '취소' 글자만으로 취소 판정, 붙여넣기 칸을 고쳐도 이전 안내가 남음, 취소된 결제도 겹침으로 봄, 경고 안 [닫기]가 알림과 함께 읽힘. 국민 후불교통 안내처럼 분석기가 무시한 문자도 짐작으로 결제가 될 수 있음(설계대로, 마지막 화면에서 확인).
- 사용자 의견으로 움직임 다듬음: + 버튼이 그대로 "쇽" 늘어나 [결제 직접 입력](아래 3초 줄) → 시간이 다 되면 "bye bye~" 흔들고 +로(× 없음), 분기 카드는 좌우로, 고르기·입력 끝내기는 모두 ✓ + 은은한 빛(`checkThen`), 새로 추가 안 화면 전환은 좌우로 밀려 들어옴. 원칙은 Claude 메모리에도 저장("모든 사용자 동작은 부드럽게 이어지게").
- 시연 화면(claude.ai 시연판, 예시 데이터)으로 사용자가 미리 눌러 봄.
- 테스트: 단위 157 · DB 122 · 화면 77 · 배포 묶음 · lint · tsc 통과. v1.5.0 배포 완료(2026-10-08 밤, DB 변경 없음): `/api/health` `833deed`, 사용량 제한 그대로, 앱 기록 오류 없음.

