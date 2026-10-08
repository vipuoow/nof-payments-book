#!/bin/sh
# 개발 환경 준비(Mac·Windows WSL2 공통). 여러 번 실행해도 된다.
#   sh scripts/setup-dev.sh          준비만
#   sh scripts/setup-dev.sh --test   준비 뒤 단위·DB·화면 테스트까지
# 비밀값(supabase/.env, jev 키, NAS 키)은 만들지 않는다. docs/status.md 4.2·4.3을 따른다.
set -eu
cd "$(dirname "$0")/.."
GITLEAKS_VERSION=8.30.1
os=$(uname -s)
step() { printf '\n▶ %s\n' "$1"; }

step "Node $(cat .node-version)"
if [ "$(node -v 2>/dev/null | sed 's/^v//')" != "$(cat .node-version)" ]; then
  if command -v fnm >/dev/null 2>&1; then
    fnm install && eval "$(fnm env)" && fnm use
  elif [ "$os" = "Darwin" ]; then
    echo "Node 버전이 다릅니다. 'brew upgrade node' 또는 fnm으로 $(cat .node-version)을 설치한 뒤 다시 실행하세요." >&2; exit 1
  else
    echo "Node 버전이 다릅니다. fnm을 설치한 뒤 다시 실행하세요:" >&2
    echo "  curl -fsSL https://fnm.vercel.app/install | bash && exec \$SHELL" >&2; exit 1
  fi
fi

step "pnpm·의존성"
corepack enable 2>/dev/null || echo "corepack enable 실패: 'npm i -g corepack' 뒤 다시 실행하세요(전역 설치 권한 문제면 fnm 사용)"
pnpm install

step "커밋 전 비밀값 검사(gitleaks $GITLEAKS_VERSION)"
git config core.hooksPath .githooks
if ! command -v gitleaks >/dev/null 2>&1; then
  if [ "$os" = "Darwin" ]; then
    brew install gitleaks
  else
    case "$(uname -m)" in x86_64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) echo "알 수 없는 CPU: $(uname -m)" >&2; exit 1 ;; esac
    mkdir -p "$HOME/.local/bin"
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${arch}.tar.gz" \
      | tar xz -C "$HOME/.local/bin" gitleaks
    case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "~/.local/bin을 PATH에 추가하세요: echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc" ;; esac
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi

step "로컬 Supabase(Docker)"
if ! docker info >/dev/null 2>&1; then
  echo "Docker가 꺼져 있어요. Docker Desktop을 켜고(WSL이면 Settings › Resources › WSL integration에서 이 배포판 켜기) 다시 실행하세요." >&2; exit 1
fi
pnpm exec supabase status >/dev/null 2>&1 || pnpm exec supabase start
# 새 마이그레이션이 있으면 적용(로컬 DB를 지우는 db reset은 쓰지 않는다)
pnpm exec supabase migration up --local

step "로컬 환경 파일"
sh scripts/write-test-env.sh
if [ -f .env.local ]; then
  echo ".env.local은 이미 있어 그대로 둡니다(새로 만들려면 지우고 다시 실행)"
else
  cp .env.test.local .env.local && echo "wrote .env.local"
fi

step "화면 테스트용 브라우저(webkit)"
if [ "$os" = "Darwin" ]; then pnpm exec playwright install webkit
else pnpm exec playwright install --with-deps webkit; fi   # 리눅스는 필요한 라이브러리도 설치(sudo 비밀번호를 물을 수 있음)

step "점검"
sh scripts/doctor.sh || true

if [ "${1:-}" = "--test" ]; then
  step "테스트"
  pnpm test && pnpm test:db && pnpm test:e2e
fi
