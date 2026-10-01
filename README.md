# nof-payments-book

카드 결제 문자를 모아 부부·커플 그룹이 함께 쓰는 가계부.

- 현황: [docs/status.md](docs/status.md)
- 설계: [docs/superpowers/specs/2026-10-01-nof-payments-book-design.md](docs/superpowers/specs/2026-10-01-nof-payments-book-design.md)

## 개발

```bash
pnpm install
git config core.hooksPath .githooks   # 커밋 전 gitleaks 검사
pnpm test                              # 단위 테스트
```

### DB 테스트 (Docker Desktop + Supabase CLI 필요)

```bash
supabase start
./scripts/write-test-env.sh   # .env.test.local 생성 (커밋 금지)
supabase db reset             # 마이그레이션 적용
pnpm test:db
```

비밀값은 `.env.local`에만 두고, 키 이름은 `.env.example`을 참고한다.
이 프로젝트는 `.npmrc`로 공개 npm 저장소(registry.npmjs.org)를 사용한다.
