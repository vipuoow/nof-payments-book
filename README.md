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

## 운영자 지정

초대 없이 가입할 수 있는 사람은 운영자뿐이다. 서버 전용 키로 직접 지정한다. 이메일은 운영자가 로그인할 **Google 계정 이메일**이어야 한다(같은 이메일의 Google 로그인과 자동으로 연결된다).

```bash
pnpm operator:grant <이메일> [이름]                                            # 로컬 DB (.env.local)
node --env-file=.env.cloud scripts/grant-operator.ts <이메일> [이름]           # 클라우드 DB
```

## 결제 문자 수신 API

```http
POST /api/ingest
Authorization: Bearer <기기 토큰>
Content-Type: application/json

{ "body": "<문자 원문>", "receivedAt": "<ISO 8601, 생략 시 서버 시각>", "source": "ios_shortcut" | "android_macrodroid" | "manual_test" }
```

| 응답 | 의미 |
|---|---|
| `200 {"status":"parsed","transactionId":...}` | 거래 저장 |
| `200 {"status":"ignored"}` | 결제가 아닌 안내 문자(후불교통 등) |
| `200 {"status":"unparsed"}` | 해석하지 못해 원문만 저장 |
| `200 {"status":"duplicate"}` | 이미 받은 문자 |
| `400` / `401` / `429` | 형식 오류 / 토큰 오류 / 분당 30회 초과 |
