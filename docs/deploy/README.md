# 배포·운영 안내 (Synology NAS)

공개 저장소이므로 실제 주소·NAS 접속 정보·비밀값은 쓰지 않는다. 사이트 주소는 `ledger.<도메인>`, NAS 프로젝트 폴더는 `<NAS 폴더>`로 쓴다.

## 1. 구성

```
아이폰 단축어 / 갤럭시 MacroDroid
        │  POST /api/ingest (기기별 연결 코드)
        ▼
Cloudflare (ledger.<도메인>) ──터널──▶ NAS
                                     ├ app          가계부(GHCR 이미지 :latest)
                                     ├ cloudflared  터널(TUNNEL_TOKEN), app:3000으로 연결
                                     ├ watchtower   5분마다 app 새 이미지 확인·교체(app만 대상)
                                     └ backup       매일 KST 04:00 DB 덤프, 30일 보관
        ▼
Supabase 클라우드(DB·로그인) — 장부 원본
```

- NAS 포트는 열지 않는다. 바깥에서 들어오는 길은 Cloudflare 터널뿐이다.
- 원격 관리는 Tailscale + SSH 키 로그인(관리용 일반 계정, `sudo`는 `docker`·`docker-compose`만 비밀번호 없이).
- 장부 원본은 Supabase에 있다. NAS가 꺼져 있는 동안 온 결제 문자는 받지 못하므로 직접 입력으로 채운다.

## 2. NAS 환경에서 주의할 점 (DSM 7.1.1)

- Docker 20.10.3, **docker-compose 1.28.5**.
  - 최상위 `name:`을 모르므로 묶음 이름은 `.env`의 `COMPOSE_PROJECT_NAME=nof-ledger`로 정한다.
  - `compose.yaml`을 자동으로 찾지 못하므로 항상 `-f compose.yaml`을 붙인다.
  - `docker-compose run`은 sudo 환경에서 `docker`를 못 찾아 실패한다. 한 번 실행할 일은 `docker exec`로 한다.
- NAS의 SFTP가 꺼져 있어 `scp`가 안 된다. 파일은 `ssh nof-nas "cat > <NAS 폴더>/파일" < 파일`로 올린다.
- NAS에 Hyper Backup이 없다. 백업 파일은 `<NAS 폴더>/backups`에만 있다.

## 2-1. 회사 NAS 사용량 제한 (2026-10-07 적용)

회사 업무용 NAS라 가계부가 업무에 지장을 주지 않도록 묶어 둔다(`deploy/compose.yaml`).

| 서비스 | 코어 | 메모리 상한(스왑 추가 없음) | 평소 사용 |
|---|---|---|---|
| app | 4번째 코어만(`cpuset: "3"`) | 512MB | 약 40~50MB |
| cloudflared | 같음 | 256MB | 약 15~30MB |
| watchtower | 같음 | 128MB | 약 5~27MB |
| backup | 같음 | 256MB | 약 2~6MB |

- NAS 커널은 CPU 비율 제한(`cpus`)을 지원하지 않아 코어 지정으로 묶는다. 가계부 전체가 CPU의 25%를 넘을 수 없다.
- 메모리 상한을 넘으면 그 서비스만 다시 시작되고 다른 업무에는 영향이 없다.
- watchtower가 app을 새 판으로 바꿀 때도 같은 제한을 그대로 옮긴다. 교체 뒤 `docker inspect -f "{{.HostConfig.CpusetCpus}} {{.HostConfig.Memory}}" nof-ledger_app_1`로 확인한다.
- 2026-10-07 점검: 평소 인터넷 사용 하루 약 60MB, 새 판 교체마다 약 45MB, 저장 공간 약 0.6GB + 백업 하루 약 0.45MB(30일 보관).
- 새 판 교체는 지금은 5분마다 확인해 바로 바꾼다. 근무 시간 교체를 피하려면 watchtower에 `WATCHTOWER_SCHEDULE`(예: 매일 03:00)을 두는 방법이 있다.

## 3. 처음 설치

1. `<NAS 폴더>`에 `deploy/compose.yaml`, `deploy/backup.sh`를 올리고 `backups/` 폴더를 만든다.
2. `deploy/.env.example`을 보고 `<NAS 폴더>/.env`(권한 600)를 만든다. 이 파일이 **운영값의 기준**이다.
   - `TUNNEL_TOKEN`: `cloudflared tunnel token nof-ledger` (화면에 출력하지 말고 바로 파일에 넣는다)
   - `BACKUP_DATABASE_URL`: Supabase **Session pooler** 주소(IPv4). NAS는 IPv6 직접 연결이 안 된다.
3. 실행: `sudo docker-compose -f compose.yaml pull && sudo docker-compose -f compose.yaml up -d`
4. 확인: `curl https://ledger.<도메인>/api/health` → `{"ok":true,"version":"<커밋 7자리>"}`

## 4. 새 버전 내보내기 (자동)

```
main에 커밋 → git tag vX.Y.Z → git push origin vX.Y.Z
 → GitHub Actions가 amd64 이미지를 GHCR에 :vX.Y.Z와 :latest로 올림(약 2~3분)
 → NAS watchtower가 5분 안에 :latest를 받아 app만 교체
 → /api/health의 version이 새 커밋으로 바뀌면 끝
```

2026-10-07 시험: v1.0.1~v1.0.3 모두 태그 후 약 3분 안에 자동 교체됨.

**환율(v1.6.0~)**: 앱이 켜질 때 한 번, 그 뒤 매일 09:10 KST에 open.er-api.com에서 환율을 받아 `fx_rates`에 저장한다(따로 도는 컨테이너 없음, 앱 컨테이너가 바깥 HTTPS로 나갈 수 있어야 함). 실패하면 앱 기록에 `[fx] 환율 받기 실패`가 남고, 2일 넘게 못 받으면 운영자 화면에 "환율 갱신 실패"가 보인다. 확인: `sudo docker-compose -f compose.yaml logs --tail 100 app | grep fx` (아무것도 없으면 정상).

## 5. 되돌리기

1. GitHub Actions의 image 작업을 **수동 실행**(workflow_dispatch)하고 `ref`에 되돌릴 태그(예: `v1.0.2`)를 넣는다.
2. 그 판이 `:latest`로 다시 올라가고, watchtower가 5분 안에 그 판으로 바꾼다.
3. 문제를 고친 뒤 새 태그를 붙이면 `:latest`가 다시 앞으로 간다.

DB 구조를 바꾼 판(마이그레이션)을 되돌릴 때는 DB를 먼저 확인한다. 이미지만 되돌리면 새 DB 구조와 옛 앱이 만날 수 있다.

## 6. 백업과 되살리기

- 자동: 매일 KST 04:00 `backups/ledger-YYYY-MM-DD.dump`(pg_dump custom 형식), 30일 지난 파일 삭제.
- 지금 한 번: `sudo docker exec -e RUN_ONCE=1 nof-ledger_backup_1 sh /backup.sh`
- **권한**: 백업에는 장부 전체·로그인 정보가 들어 있어 `backups/`는 700, 파일은 600(root)이다(2026-10-07). 시놀로지 공유 폴더 권한(모든 사람 읽기)이 이어지지 않도록 리눅스 권한으로 바꿔 두었고, `backup.sh`가 새 파일도 600으로 만든다. 관리용 계정으로도 직접 읽을 수 없으므로 꺼낼 때는 `sudo docker exec nof-ledger_backup_1 cat /backups/ledger-YYYY-MM-DD.dump > 받을파일`처럼 컨테이너를 거친다.
- **되살리기 시험(2026-10-07 통과)**: 빈 Postgres 17에 아래처럼 넣으면 거래·문자·그룹·구성원·연결 코드·로그인 계정이 모두 돌아온다. `supabase_vault` 관련 오류 3줄은 Supabase 전용 확장이라 무시한다.

  ```sh
  pg_restore -d <대상 DB> --no-owner --no-privileges ledger-YYYY-MM-DD.dump
  ```
- 실제 장부를 되살릴 때는 Supabase 쪽을 먼저 백업하고, 대상 DB를 비운 뒤 넣는다. 서두르지 말고 단계마다 확인한다.

## 6-1. 처음 화면 배경 영상 바꾸기

- NAS `<NAS 폴더>/media/`에 `landing.mp4`(영상)와 `landing.jpg`(멈춘 그림)를 둔다. 앱은 이 폴더를 읽기 전용으로 연결한다(`compose.yaml`의 `./media:/app/media:ro`).
- 바꿀 때는 같은 이름으로 덮어쓰기만 하면 된다. 다시 배포하거나 앱을 다시 시작할 필요가 없다. 주소 뒤에 파일 수정 시각이 붙어 휴대폰이 새 영상을 받는다.
- 파일을 올리는 법(SFTP가 꺼져 있어 `ssh cat`): `ssh <NAS> "cat > <NAS 폴더>/media/landing.mp4" < landing.mp4`
- 영상은 휴대폰에서 빨리 열리도록 1~2MB(H.264, 세로 960px 안팎)로 줄여서 넣는다. 멈춘 그림은 영상 첫 장면을 JPEG로 저장한다('동작 줄이기'를 켠 휴대폰과 가계부 친구 그림에 쓴다).
- 파일이 없으면 처음 화면은 단색 배경으로 정상 동작한다. 영상 파일은 공개 저장소(GitHub)에 올리지 않는다.

## 7. 자주 쓰는 명령 (NAS, `<NAS 폴더>` 안)

```sh
sudo docker-compose -f compose.yaml ps                      # 상태
sudo docker-compose -f compose.yaml logs --tail 50 app      # 앱 기록
sudo docker-compose -f compose.yaml pull && sudo docker-compose -f compose.yaml up -d   # 수동 갱신
```

## 8. 운영자 지정·관리 스크립트

클라우드 접속값은 NAS `.env`에만 있다. Mac에 파일로 남기지 않고 그때그때 읽어 쓴다.

```sh
node --env-file=<(ssh nof-nas 'grep -E "^SUPABASE_(URL|SERVICE_ROLE_KEY)=" <NAS 폴더>/.env') \
  scripts/grant-operator.ts <구글 이메일> <이름>
```

## 9. 기기 연결

- 아이폰: 미리 만든 단축어 `public/shortcuts/가계부로 보내기.shortcut`(주소·연결 코드 없음, 서명됨)을 받아 추가한다. 그다음 단축어 맨 위 텍스트 칸에 '내 기기 연결' 화면의 연결 코드(`<받는 주소> <토큰>`)를 붙여넣는다. 2026-10-07 첫 시도 때 글자를 길게 누르면 보기 전용 메뉴(복사·찾아보기·번역)만 나와 고칠 수 없는 것처럼 보였다. 이때는 칸을 짧게 한 번 눌러 본다. 그래도 안 되면 연결 코드를 미리 넣은 단축어를 Mac에서 만들어 전달하는 방법이 있다(그 파일은 저장소에 넣지 않는다).
- 단축어 파일을 바꿀 때는 Mac에서 `python3 scripts/build-ios-shortcut.py`(서명 포함)로 다시 만든다. 추가 화면에서 연결 코드를 묻는 방식(import question)은 아이폰에서 [단축어 추가]가 눌리지 않아 쓰지 않는다.
- 단축어를 손으로 실행하면 본문이 비어 '연결 확인'만 한다(기록 없음, 마지막 수신 시각만 갱신).
- 2026-10-07: 잠긴 아이폰에서 국민카드 결제 → 1분 안에 자동 기록 확인.
