#!/bin/sh
# 개발 환경 점검: Mac과 Windows(WSL2)가 같은 환경인지 확인한다. 고치지는 않는다(고치기는 scripts/setup-dev.sh).
# ✅ 맞음 · ⚠️ 없어도 개발은 됨 · ❌ 고쳐야 함. ❌가 하나라도 있으면 종료 코드 1.
cd "$(dirname "$0")/.." || exit 1
fail=0
ok() { echo "✅ $1"; }
warn() { echo "⚠️  $1"; }
bad() { echo "❌ $1"; fail=1; }

GITLEAKS_VERSION=8.30.1

# 컴퓨터 종류
if grep -qi microsoft /proc/version 2>/dev/null; then
  ok "Windows WSL2"
  case "$(pwd)" in
    /mnt/*) bad "저장소가 Windows 드라이브(/mnt/...)에 있어요. WSL 안쪽(~/dev)에 두어야 빠르고 파일 감시가 돼요" ;;
  esac
elif [ "$(uname -s)" = "Darwin" ]; then
  ok "Mac"
else
  warn "Mac·WSL이 아닌 환경($(uname -s))"
fi

# Node: .node-version과 같아야 한다
want_node=$(cat .node-version)
have_node=$(node -v 2>/dev/null | sed 's/^v//')
if [ -z "$have_node" ]; then bad "Node가 없어요(필요: $want_node)"
elif [ "$have_node" = "$want_node" ]; then ok "Node $have_node"
elif [ "${have_node%%.*}" = "${want_node%%.*}" ]; then warn "Node $have_node (고정 버전 $want_node과 다름, 같은 대 버전이라 대체로 괜찮음)"
else bad "Node $have_node (필요: $want_node)"; fi

# pnpm: package.json의 packageManager와 같아야 한다
want_pnpm=$(sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' package.json)
have_pnpm=$(pnpm -v 2>/dev/null)
if [ "$have_pnpm" = "$want_pnpm" ]; then ok "pnpm $have_pnpm"; else bad "pnpm ${have_pnpm:-없음} (필요: $want_pnpm, 'corepack enable')"; fi

# 의존성·Supabase CLI(프로젝트에 고정)
if [ -x node_modules/.bin/supabase ]; then
  want_sb=$(sed -n 's/.*"supabase": "\([^"]*\)".*/\1/p' package.json)
  have_sb=$(node_modules/.bin/supabase --version 2>/dev/null | head -1)
  if [ "$have_sb" = "$want_sb" ]; then ok "Supabase CLI $have_sb (프로젝트 고정)"; else bad "Supabase CLI ${have_sb:-실행 안 됨} (필요: $want_sb)"; fi
else
  bad "의존성이 설치되지 않았어요('pnpm install')"
fi

# gitleaks: 커밋 전 비밀값 검사
have_gl=$(gitleaks version 2>/dev/null)
if [ -z "$have_gl" ]; then bad "gitleaks가 없어요(커밋 전 비밀값 검사)"
elif [ "$have_gl" = "$GITLEAKS_VERSION" ]; then ok "gitleaks $have_gl"
else warn "gitleaks $have_gl (고정 버전 $GITLEAKS_VERSION과 다름)"; fi
if [ "$(git config core.hooksPath)" = ".githooks" ]; then ok "커밋 전 검사 연결됨"; else bad "커밋 전 검사가 꺼져 있어요('git config core.hooksPath .githooks')"; fi

# Docker·로컬 Supabase
if docker info >/dev/null 2>&1; then
  ok "Docker 실행 중"
  if node_modules/.bin/supabase status >/dev/null 2>&1; then ok "로컬 Supabase 실행 중"; else bad "로컬 Supabase가 꺼져 있어요('pnpm exec supabase start')"; fi
else
  bad "Docker가 꺼져 있어요(Docker Desktop 실행, WSL이면 Settings › Resources › WSL integration 켜기)"
fi

# 환경 파일(로컬 전용 값)
for f in .env.local .env.test.local; do
  if grep -q '^NEXT_PUBLIC_SUPABASE_URL=\|^SUPABASE_URL=' "$f" 2>/dev/null; then ok "$f"; else bad "$f 없음('sh scripts/write-test-env.sh')"; fi
done

# Playwright 브라우저(webkit)
cache="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
[ "$(uname -s)" = "Darwin" ] && cache="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"
if ls -d "$cache"/webkit-* >/dev/null 2>&1; then ok "Playwright webkit"; else bad "Playwright webkit 없음('pnpm exec playwright install --with-deps webkit')"; fi

# 없어도 되는 것(git에 없는 파일, docs/status.md 4.2)
[ -r supabase/.env ] && ok "로컬 Google 로그인 설정(supabase/.env)" || warn "supabase/.env 없음: 로컬 Google 로그인만 안 됨"
{ [ -r "$HOME/.config/typesafe/api_key" ] || [ -n "${TYPESAFE_API_KEY:-}" ]; } && ok "jev 키" || warn "jev 키 없음: 자동 분류만 건너뜀"
grep -q '^Host nof-nas' "$HOME/.ssh/config" 2>/dev/null && ok "NAS 접속 설정(nof-nas)" || warn "NAS 접속 설정 없음: 배포만 못 함(docs/status.md 4.3)"

echo
if [ "$fail" = 0 ]; then echo "점검 끝: 개발할 준비가 됐어요."; else echo "점검 끝: ❌ 항목을 고쳐 주세요('pnpm dev:setup'이 대부분 고쳐요)."; fi
exit "$fail"
