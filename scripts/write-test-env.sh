#!/bin/sh
# 로컬 Supabase 접속값을 .env.test.local에 기록한다. (로컬 전용 키, 커밋 금지)
set -e
# 프로젝트에 고정한 Supabase CLI(package.json)를 쓴다
eval "$(pnpm exec supabase status -o env 2>/dev/null)"
cat > .env.test.local <<ENV
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
APP_URL=http://127.0.0.1:3100
ENV
echo "wrote .env.test.local"
