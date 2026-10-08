#!/bin/sh
# 새 DB에서 마이그레이션 전체가 적용되는지 확인한다. 기존 로컬 Supabase는 건드리지 않는다.
set -eu
root=$(pwd)
work=$(mktemp -d)
# 정리는 임시 프로젝트 이름으로만 한다. 설정 변경 전에 실패해도 기존 로컬 프로젝트를 멈추지 않는다.
cleanup() { "$root/node_modules/.bin/supabase" stop --project-id nof-fresh-check --no-backup >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

mkdir -p "$work/repo"
# 추적 중인 파일만 복사한다(.env·node_modules 제외)
git ls-files -z | xargs -0 tar cf - | (cd "$work/repo" && tar xf -)
ln -s "$root/node_modules" "$work/repo/node_modules"
cd "$work/repo"
# 별도 프로젝트 이름과 겹치지 않는 포트
# sed -i는 Mac과 리눅스(WSL)의 쓰는 법이 달라 임시 파일로 바꾼다
sed -e 's/^project_id = .*/project_id = "nof-fresh-check"/' \
  -e 's/^port = 543\([0-9][0-9]\)/port = 553\1/' -e 's/^shadow_port = 54320/shadow_port = 55320/' supabase/config.toml > supabase/config.toml.tmp
mv supabase/config.toml.tmp supabase/config.toml
# 이름이 바뀌지 않았으면 기존 프로젝트를 건드릴 수 있으니 여기서 멈춘다
grep -qx 'project_id = "nof-fresh-check"' supabase/config.toml || { echo "project_id 변경 실패: 중단" >&2; exit 1; }
"$root/node_modules/.bin/supabase" start -x studio,imgproxy,mailpit,vector,logflare,edge-runtime,supavisor >/dev/null
eval "$("$root/node_modules/.bin/supabase" status -o env)"
cat > .env.test.local <<ENV
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ENV
# pnpm은 바깥을 가리키는 node_modules 링크를 보고 재설치하려 하므로 vitest를 직접 실행한다
# 셸에 남은 SUPABASE_* 값(예: .env.cloud)이 임시 DB 값을 덮지 않게 명시한다
env SUPABASE_URL="$API_URL" SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
  "$root/node_modules/.bin/vitest" run tests/db --no-file-parallelism
echo "새 DB 마이그레이션 확인 완료"
