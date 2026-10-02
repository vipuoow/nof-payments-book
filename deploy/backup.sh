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
    # 재시작 등으로 중단된 덤프 조각(하루 넘은 것)도 정리한다
    find /backups -name '.ledger-*.dump.partial' -mtime +1 -delete
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
