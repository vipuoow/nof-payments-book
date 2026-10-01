#!/bin/sh
# 로컬 Supabase 접속값을 .env.test.local에 기록한다. (로컬 전용 키, 커밋 금지)
set -e
eval "$(supabase status -o env)"
cat > .env.test.local <<ENV
SUPABASE_URL=$API_URL
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ENV
echo "wrote .env.test.local"
