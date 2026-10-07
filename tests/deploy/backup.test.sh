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
# 중단된 덤프 조각: 하루 넘은 것만 지운다
touch -t "$(date -v-2d +%Y%m%d%H%M)" "$dir/.ledger-2000-03-01.dump.partial"

run "postgresql://postgres:postgres@host.docker.internal:54322/postgres"
today=$(TZ=Asia/Seoul date +%F)
[ -s "$dir/ledger-$today.dump" ] || { echo "FAIL: 오늘 덤프 없음"; exit 1; }
# 백업에는 장부 전체·로그인 정보가 있으므로 주인만 읽을 수 있어야 한다(NAS 다른 계정 차단)
mode=$(stat -f %Lp "$dir/ledger-$today.dump" 2>/dev/null || stat -c %a "$dir/ledger-$today.dump")
[ "$mode" = "600" ] || { echo "FAIL: 백업 파일 권한 $mode (600이어야 함)"; exit 1; }
[ ! -e "$dir/ledger-2000-01-01.dump" ] || { echo "FAIL: 40일 지난 파일이 남음"; exit 1; }
[ -e "$dir/ledger-2000-02-01.dump" ] || { echo "FAIL: 10일 된 파일이 지워짐"; exit 1; }
[ ! -e "$dir/.ledger-2000-03-01.dump.partial" ] || { echo "FAIL: 오래된 조각 파일이 남음"; exit 1; }

rm "$dir/ledger-$today.dump"
if run "postgresql://postgres:wrong@host.docker.internal:54322/postgres"; then echo "FAIL: 실패를 성공으로 보고"; exit 1; fi
[ ! -e "$dir/ledger-$today.dump" ] || { echo "FAIL: 실패한 덤프 파일이 남음"; exit 1; }
[ -e "$dir/ledger-2000-02-01.dump" ] || { echo "FAIL: 실패 때 기존 파일이 지워짐"; exit 1; }
echo "PASS"
