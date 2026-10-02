# NAS 배포 설계 (계획 4)

작성일: 2026-10-02
상태: 설계 확정, 구현 계획 작성 전
상위 설계: `docs/superpowers/specs/2026-10-01-nof-payments-book-design.md` (10장 배포, 11장 미결 사항)

## 1. 목표

가계부를 Synology NAS(DS920+)에서 실행하고, 휴대폰이 어디에 있든 HTTPS 주소로 접속·문자 전송이 되게 한다. 데이터는 클라우드 Supabase에 두고 NAS가 매일 백업한다. 새 버전은 승인한 태그를 붙일 때만 NAS에 자동 반영된다.

**성공 기준**

- `https://ledger.<도메인>`에서 아이폰으로 Google 로그인 → 가계부 사용이 된다.
- 잠긴 아이폰에서 국민카드 결제 문자가 자동으로 서버에 전송되어 거래가 생긴다(상위 설계 11장 미결 사항 해소, 실패하면 결과를 기록하고 대안 검토).
- `v*` 태그를 붙이면 사람 손 없이 NAS의 앱이 새 버전으로 바뀐다.
- NAS에 매일 DB 백업 파일이 생기고, 그 파일로 복구가 되는 것을 한 번 확인한다.
- 공개 저장소에 도메인·주소·비밀값이 올라가지 않는다.

**사용자가 정한 것 (2026-10-02)**

| 질문 | 결정 |
|---|---|
| 외부 주소 | Cloudflare Tunnel(포트 개방 없음) |
| 도메인 | 닷네임코리아(dotname.com)에서 산 도메인을 Cloudflare 네임서버로 연결. 가계부는 하위 주소 `ledger.<도메인>` |
| 작업 주체 | 모든 단계를 Claude가 수행. 계정 로그인·2단계 인증·비밀번호 입력만 사용자가 처음 한 번 |
| 새 버전 반영 | 승인한 `v*` 태그만 이미지 빌드, NAS의 Watchtower가 자동 반영. DB 마이그레이션은 자동 적용하지 않음 |
| 백업 | NAS가 매일 클라우드 DB를 덤프해 30일 보관 |
| 기존 데이터 | 옮기지 않음. 새로 시작하고 기존 서비스는 조회용으로 한동안 유지 |
| 이미지 공개 | GHCR 이미지를 공개(이미지에 비밀값 없음, NAS에 GitHub 토큰 불필요) |

진행 상황(2026-10-02): Cloudflare에 도메인 추가 완료, 닷네임 네임서버 변경은 사용자가 진행 중. 백업 시각(KST 04:00) 확정.

## 2. 구성

```text
아이폰 단축어 / 브라우저
  → https://ledger.<도메인>   (Cloudflare: HTTPS·인증서)
  → Cloudflare Tunnel ─(NAS에서 나가는 연결)→ cloudflared 컨테이너
  → app 컨테이너 (Next.js standalone, 포트는 컨테이너 네트워크 안에서만)
  → 클라우드 Supabase (DB·Auth)
```

### 2.1 NAS 프로젝트 `nof-ledger`

Container Manager 프로젝트(docker compose) 하나. 폴더(예: `/volume1/docker/nof-ledger/`, 실제 경로는 NAS를 확인해 정함)에 `compose.yaml`과 `.env`(권한 600), `backups/`를 둔다.

| 서비스 | 이미지 | 역할 |
|---|---|---|
| `app` | `ghcr.io/vipuoow/nof-payments-book:latest` | 가계부. 외부 포트 없음. 재시작 정책 `unless-stopped` |
| `cloudflared` | `cloudflare/cloudflared` | `tunnel run --token`으로 Tunnel 연결. 공개 주소 `ledger.<도메인>` → `http://app:3000` |
| `watchtower` | `nickfedor/watchtower`(원본 `containrrr/watchtower`는 보관 상태라 관리되는 후속 이미지 사용) | 라벨이 붙은 `app`만 감시, 새 이미지면 받아서 다시 시작, 이전 이미지 정리 |
| `backup` | `postgres:17-alpine` | 매일 새벽(KST 04:00) `pg_dump -Fc`로 `backups/ledger-YYYY-MM-DD.dump` 저장, 30일 지난 파일 삭제 |

- 저장소에 `deploy/compose.yaml`과 `deploy/.env.example`(키 이름만)을 둔다. NAS에는 이것을 복사해 쓴다.
- 백업은 Supabase **Session pooler** 주소(IPv4)를 쓴다. 무료 플랜의 직접 접속은 IPv6 전용이라 NAS에서 안 될 수 있다.
- 백업 파일은 NAS 공유 폴더 안에 있어, 사용자가 쓰는 NAS 백업(Hyper Backup 등)에 함께 포함될 수 있다.

### 2.2 이미지 빌드 (GitHub Actions)

- 트리거: `v*` 태그 푸시, 그리고 되돌리기용 수동 실행(태그 입력).
- `linux/amd64`로 빌드해 GHCR에 `:<태그>`와 `:latest`로 올린다. 패키지는 공개.
- 빌드 인자: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`(GitHub 저장소 변수, 공개 값), `GIT_SHA`(빌드한 커밋).
- `Dockerfile`이 이 빌드 인자를 받아 `pnpm build`에 넘기도록 고친다. 서버 비밀값은 이미지에 넣지 않는다.

### 2.3 앱 쪽 추가

- `GET /api/health`: `{ "ok": true, "version": "<GIT_SHA 앞 7자리 또는 dev>" }`. 로그인 없이 열린다(proxy 공개 경로). DB를 부르지 않는다.

## 3. 작업 방법과 사용자 도움

| 대상 | Claude의 방법 | 사용자가 처음 한 번 |
|---|---|---|
| GitHub(Actions, 패키지 공개, 저장소 변수) | `gh` 명령 | 권한이 더 필요하면 그때 `gh auth refresh` |
| Cloudflare(Tunnel, DNS) | Chrome으로 대시보드 조작 | Chrome에서 로그인 상태 유지 |
| Supabase(마이그레이션, Auth 설정) | Supabase CLI·Management API, 필요하면 Chrome | 터미널 `! supabase login`, DB 비밀번호 입력 |
| Google Cloud Console(OAuth 리디렉션 주소) | Chrome | 로그인 상태 유지 |
| NAS DSM(Container Manager 설치, SSH 켜기) | Chrome으로 DSM 화면 조작 | DSM 로그인 |
| NAS 셸(프로젝트 파일·실행·확인) | SSH | `! ssh-copy-id`로 키 등록 시 비밀번호 1회, sudo 비밀번호가 필요하면 그때 |

**원칙**

- 상태를 바꾸는 모든 작업(설치, 설정 변경, 공개, 비밀값 배치, 클라우드 DB 적용, 태그)은 하기 전에 설명하고 승인을 받는다. 상태 확인(읽기)은 구분해 진행한다.
- 비밀값은 화면·대화·로그에 출력하지 않는다. 파일에서 읽어 바로 쓰거나 사용자가 터미널에 입력한다. 브라우저 화면의 비밀값(예: Tunnel 토큰)은 복사 버튼 → NAS 파일 붙여넣기로 옮기고, 그것이 안 되면 그 단계만 사용자가 붙여넣는다.
- NAS SSH 키는 이 Mac의 `~/.ssh`에만 둔다.
- 실제 도메인·주소는 저장소에 커밋하지 않는다. 문서에는 `ledger.<도메인>`으로 쓴다.

## 4. 배포 순서

1. **저장소 준비**: `/api/health`, `Dockerfile` 빌드 인자, GitHub Actions 워크플로, `deploy/compose.yaml`·`deploy/.env.example`·백업 스크립트, 안내 문서 `docs/deploy/`.
2. **새 DB에서 마이그레이션 확인**: 저장소를 임시 폴더에 복사하고 `project_id`·포트를 바꿔 별도의 로컬 Supabase를 띄워, 마이그레이션 전체 적용 + DB 테스트 후 정리한다. 기존 로컬 DB는 건드리지 않는다.
3. **클라우드 DB 적용**(승인 후): 그룹 카테고리 이름 중복 확인 쿼리 → 적용 직전 백업(`pg_dump`) → `supabase db push`.
4. **클라우드 Auth 설정**: 사이트 주소·이동 허용 주소를 `https://ledger.<도메인>`으로, 이메일 공급자 끔, Google 공급자 켬(클라이언트 ID·비밀값). Google Cloud Console의 승인된 리디렉션 주소에 Supabase 콜백이 있는지 확인.
5. **Cloudflare**: 네임서버 적용(Active) 확인 → Tunnel 생성 → 공개 주소 `ledger.<도메인>` → `http://app:3000`.
6. **이미지**: GitHub 저장소 변수 설정 → `v1.0.0` 태그(승인 후) → 빌드 확인 → GHCR 패키지 공개.
7. **NAS**: Container Manager 설치 → SSH 켜기·키 등록 → 프로젝트 폴더·`compose.yaml`·`.env`(600) 배치 → 프로젝트 실행.
8. **확인**: `/api/health` → 아이폰 Google 로그인 → 운영자 지정(`scripts/grant-operator.ts`, 이 Mac의 `.env.cloud`) → 그룹 만들기·배우자 초대 → 두 사람 기기 연결 → **잠긴 아이폰 문자 전송** → 다음 날 백업 파일 확인 → 백업을 로컬에 복구해 거래 수 확인.

## 5. 비밀값

| 위치 | 값 | 비고 |
|---|---|---|
| NAS `.env`(600) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `TYPESAFE_API_KEY`, `TUNNEL_TOKEN`, `BACKUP_DATABASE_URL`(Session pooler, 비밀번호 포함) | 저장소에는 키 이름만(`deploy/.env.example`) |
| GitHub 저장소 변수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 값 |
| 이 Mac `.env.cloud` | 운영자 지정 스크립트용 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | git 제외. 커밋 전 검사가 이 값을 대조 |

## 6. 되돌리기와 운영

- **앱**: 이전 태그로 워크플로를 수동 실행 → `:latest`가 이전 버전이 되고 Watchtower가 바꾼다.
- **DB**: 마이그레이션은 자동으로 되돌리지 않는다. 적용 직전 백업으로 복구한다.
- **장애 확인**: 별도 알림은 두지 않는다. 기기 화면의 "3일 넘게 문자 없음" 경고, Cloudflare의 Tunnel 상태, `/api/health`로 확인한다.
- **Supabase 무료 플랜 일시 중지**: 매일 백업 접속과 문자 수신이 있어 사실상 활성 상태가 유지될 것으로 본다. 구성할 때 최신 조건을 다시 확인한다.
- **기존 서비스(Sites)**: 새 서비스가 확인될 때까지 유지하고, 종료 시점은 나중에 사용자와 정한다.

## 7. 테스트

| 대상 | 방법 |
|---|---|
| `/api/health` 응답·로그인 없이 열림 | Playwright |
| `deploy/compose.yaml` 형식 | `docker compose config` |
| 백업 스크립트 | 로컬 Supabase를 대상으로 실행해 덤프 생성·30일 정리 동작 확인 |
| 마이그레이션 전체 | 새 로컬 Supabase에서 적용 + `pnpm test:db` |
| 실제 배포 | 4장 8단계 확인 목록 |

## 8. 범위 밖

- 기존 서비스 데이터 이전(사용자 결정)
- 장애 알림(푸시·메일)
- 갤럭시 실기기 확인(사용자 없음)
