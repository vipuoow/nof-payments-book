# 가족 가계부 설계 (nof-payments-book)

작성일: 2026-10-01
상태: 설계 확정, 구현 계획 작성 전

## 1. 목표와 범위

카드 결제 문자를 자동으로 모아 그룹(부부·커플) 단위로 지출을 함께 보는 가계부. 지금은 소수 사용자로 시작하지만, 그룹 격리·역할·초대·카드사 확장 구조를 처음부터 갖춰 서비스를 넓힐 수 있게 한다. 운영 환경은 바뀔 수 있으므로 특정 호스팅에 묶이지 않게 만든다.

**성공 기준**

- 결제 후 사용자가 아무것도 하지 않아도 거래가 그룹 가계부에 기록된다.
- 같은 그룹 구성원은 같은 가계부를 보고 함께 관리한다.
- 다른 그룹의 데이터는 DB 권한 수준에서 읽기·쓰기가 불가능하다.

**포함 (v1)**

- 초대 기반 가입, 그룹 생성·초대, Google 로그인
- 아이폰·갤럭시의 결제 문자 자동 전송, 국민카드 문자 분석
- 가족·개인·카테고리·월별 조회, 수동 입력, 카테고리 수정·규칙 학습
- 미분류 문자 처리
- 월 예산(그룹 전체·카테고리별)과 앱 내 초과 표시

**제외 (v1 이후)**

- 푸시·이메일 알림 (예산 초과 포함)
- 엑셀 내보내기
- 국민카드 외 카드사 분석기 (구조만 준비)
- 카드사 앱 푸시 알림 읽기
- 사람별 예산
- 한 사용자의 다중 그룹 소속

## 2. 사용자와 권한

| 역할 | 할 수 있는 일 |
|---|---|
| 운영자 | 서비스 초대 링크 발급, 사용자·그룹 현황 조회, 그룹 구성원 조정 |
| 그룹장 | 그룹 생성, 그룹 초대 링크 발급·취소 |
| 그룹원 | 그룹 가계부 조회·관리, 예산·카테고리 수정, 본인 기기 연결 |

**제한 (`app_settings`의 설정값, 하드코딩 금지)**

| 키 | 기본값 |
|---|---|
| `max_group_members` | 2 |
| `max_users` | 30 |
| `invite_ttl_days` | 7 |
| `raw_message_retention_days` | 365 |
| `budget_warning_ratio` | 0.8 |
| `category_ai_min_confidence` | 0.7 |

**가입 흐름**

1. 운영자가 서비스 초대 링크를 발급한다.
2. 초대받은 사람이 링크 → "Google로 가입" → 이름 확인(Google 이름 기본값) → 수락으로 가입하고, 그룹 생성 권한(`can_create_group`)을 받는다. 초대 링크만 있으면 어느 Google 계정으로든 가입할 수 있다(링크는 1회용, 7일 만료).
3. 그룹을 만들면 그룹장이 된다.
4. 그룹장이 그룹 초대 링크를 발급해 배우자에게 보낸다.
5. 배우자는 같은 방식으로 가입하고 곧바로 그룹에 소속된다.
6. 초대 없이 Google 로그인하면 Supabase 인증 계정은 생기지만 프로필이 없으므로 즉시 로그아웃시키고 "초대 링크로 가입을 마쳐 주세요"를 안내한다. 프로필이 없으면 RLS로 어떤 데이터에도 접근할 수 없다.
7. 로그인은 Google 로그인만 쓴다(비밀번호 없음). 운영자는 `pnpm operator:grant <Google 이메일>`로 미리 지정하고, 같은 이메일의 Google 계정으로 로그인하면 연결된다.

그룹장의 그룹 탈퇴·구성원 내보내기는 v1에서 운영자가 처리한다.

## 3. 구조

```text
아이폰 단축어 / 갤럭시 MacroDroid ──POST /api/ingest (사람별 토큰)──┐
브라우저(모바일 PWA) ── 화면 (Google 로그인 세션) ──────────────────┤
                                                     Next.js 앱 (TypeScript, Docker)
                                                                    │ Supabase 클라이언트 + RLS
                                                             Supabase (Postgres, Auth)
```

- **Next.js 앱 하나**가 화면과 API를 함께 제공하고 Docker 컨테이너로 실행한다. 첫 배포 대상은 Synology NAS(Container Manager).
- **문자 분석기**는 프레임워크와 무관한 순수 TypeScript 모듈(`src/parsers/`)로 둔다. 나중에 수신을 다른 런타임(예: Edge Function)으로 옮겨도 그대로 쓴다.
- **DB 접근**
  - 화면: 로그인 사용자의 세션(anon key)으로만 접근하고 RLS를 적용한다.
  - 서버 전용 작업(`/api/ingest`, 초대 수락): `service_role` 키를 쓴다. 이 키는 서버 코드에서만 읽고 브라우저 번들에 포함하지 않는다.

## 4. 데이터 모델

모든 그룹 데이터 테이블은 `group_id`를 가지며, RLS로 "내가 속한 그룹"의 행만 접근하게 한다.

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| `profiles` | `user_id`, `display_name`, `is_operator`, `can_create_group` | `auth.users`와 1:1 |
| `service_invites` | `token_hash`, `created_by`, `expires_at`, `used_by`, `used_at` | 운영자만 발급 |
| `groups` | `id`, `owner_id`, `created_at` | 이름 없음. 화면에는 역할(그룹장·그룹원)과 초대한 사람 이름만 표시 |
| `group_members` | `group_id`, `user_id`, `role`(owner/member) | `user_id` unique (한 사람 한 그룹) |
| `group_invites` | `group_id`, `token_hash`, `created_by`, `expires_at`, `used_by`, `revoked_at` | 그룹장만 발급 |
| `ingest_tokens` | `user_id`, `token_hash`, `label`, `last_used_at`, `revoked_at` | 원문 토큰은 발급 시 한 번만 표시 |
| `raw_messages` | `group_id`, `user_id`, `body`(마스킹), `body_hash`, `source`, `received_at`, `status`, `parser_id` | `status`: parsed / unparsed / ignored. `duplicate`는 저장하지 않고 ingest API 응답에만 쓴다 |
| `transactions` | `group_id`, `user_id`, `raw_message_id`, `kind`(approval/cancel/manual), `amount`, `merchant`, `occurred_at`, `issuer`, `category_id`, `category_source`(rule/ai/user), `cancels_transaction_id`, `memo` | 취소는 음수 금액. `category_source`는 카테고리를 정한 주체 |
| `categories` | `group_id`(null이면 기본), `name`, `sort_order` | |
| `merchant_rules` | `group_id`, `merchant_pattern`, `category_id` | 카테고리 수정 시 학습 |
| `budgets` | `group_id`, `category_id`(null이면 전체), `month`, `amount` | |
| `app_settings` | `key`, `value` | 2장의 설정값 |

**제약과 DB 함수**

- 초대 수락은 DB 함수 하나(`accept_invite`)에서 트랜잭션으로 처리한다. 순서는 토큰 확인 → 만료·사용 여부 확인 → 서비스 인원(`max_users`) 확인 → 그룹 인원(`max_group_members`) 확인 → 소속 등록. 동시에 요청이 와도 제한을 넘지 않게 그룹 행을 잠근다.
- `raw_messages`의 (`user_id`, `body_hash`)는 unique로 두어 중복 문자를 막는다.
- `transactions.raw_message_id`는 `on delete set null`로 둔다. 원문을 보관 기간이 지나 삭제해도 거래는 남는다.
- 초대·토큰은 32바이트 무작위 값으로 만들고, DB에는 SHA-256 해시만 저장한다.

## 5. 문자 수신과 분석

**기기별 전송 설정**

| 항목 | 아이폰 | 갤럭시 |
|---|---|---|
| 도구 | 단축어 개인용 자동화 | MacroDroid (대안: Tasker) |
| 실행 조건 | 메시지 수신 (카드사 발신번호) | SMS 수신 (카드사 발신번호) |
| 전송 | URL 내용 가져오기 → `POST /api/ingest` | HTTP 요청 동작 → `POST /api/ingest` |
| 주의할 점 | 잠금 상태 실행 여부 검증 필요 | 배터리 최적화 제외, SMS 권한 |

MacroDroid 무료판의 제한과 HTTP 요청 지원 여부는 구현 전에 최신 정보로 다시 확인한다.

**API**

```http
POST /api/ingest
Authorization: Bearer <ingest token>
Content-Type: application/json

{ "body": "<문자 원문>", "receivedAt": "<ISO 8601>", "source": "ios_shortcut" | "android_macrodroid" | "manual_test" }
```

| 응답 | 조건 |
|---|---|
| `200 { status }` | 저장 완료. `status`는 parsed / unparsed / ignored / duplicate |
| `400` | 본문 형식 오류 |
| `401` | 토큰이 없거나, 틀렸거나, 폐기됨 |
| `429` | 토큰당 분당 30회 초과 |

**처리 순서**

1. 토큰 해시로 사용자와 그룹을 찾고 `last_used_at`을 갱신한다.
2. 카드번호 등을 마스킹한 원문을 `raw_messages`에 저장한다. 중복이면 `duplicate`로 응답하고 끝낸다.
3. 분석기 목록에서 `canParse(body)`가 참인 첫 분석기로 분석한다.
4. 결과에 따라 처리한다.
   - `approval`: 거래를 생성한다. 금액은 결제 금액이며 누적 사용액은 쓰지 않는다.
   - `cancel`: 최근 60일 안에서 같은 사용자·금액·가맹점의 승인 거래를 찾아 `cancels_transaction_id`로 연결하고, 음수 금액 거래를 생성한다. 원 거래를 못 찾아도 음수 거래는 생성한다.
   - `ignore`: 후불교통 결제 예정 안내처럼 결제가 아닌 문자다. 거래를 만들지 않는다.
   - `unknown`: `unparsed` 상태로 둔다. 미분류 화면에서 처리한다.
5. 문자에 연도가 없으면 `receivedAt`을 기준으로 정한다. 문자의 월이 수신 월보다 크면(예: 1월에 받은 12월 결제) 전년도로 본다.
6. 카테고리는 `merchant_rules`에 맞는 규칙이 있으면 그대로 정한다(`rule`). 취소는 연결된 승인 거래의 카테고리를 이어받는다. 둘 다 없으면 `category_id`를 null(화면에는 "미지정")로 둔다.
7. 카테고리가 비어 있는 승인·취소 거래는 응답을 보낸 뒤 TypeSafe의 jev 모델로 분류한다(Choice 질문, 선택지는 기본 + 그룹 카테고리).
   - jev 확신이 `category_ai_min_confidence`(0.7) 이상이고 "기타"가 아닐 때만 카테고리를 넣는다(`ai`). 그 밖에는 "미지정"으로 둔다.
   - jev가 느리거나 실패해도 문자 저장과 응답에는 영향이 없다(5초 뒤 포기). `TYPESAFE_API_KEY`가 없으면 분류하지 않는다.
   - jev 결과는 `merchant_rules`에 저장하지 않는다. 규칙은 사용자가 고친 결과로만 배운다. 사용자가 카테고리를 바꾸면 `category_source`는 `user`가 된다.

**분석기 인터페이스**

```ts
interface CardSmsParser {
  id: string;                       // 예: "kb-card"
  canParse(body: string): boolean;
  parse(body: string, receivedAt: Date): ParseResult;
}

type ParseResult =
  | { kind: "approval" | "cancel"; amount: number; merchant: string; occurredAt: Date; issuer: string }
  | { kind: "ignore"; reason: string }
  | { kind: "unknown" };
```

카드사를 추가할 때는 `src/parsers/<issuer>.ts`와 테스트 픽스처를 넣고 목록에 등록한다. 테스트 픽스처는 공개 저장소에 올라가므로 금액·가맹점·카드번호·이름을 가상 값으로 바꿔 넣는다.

## 6. 화면

모바일 우선 PWA(홈 화면에 추가)로 만든다.

| 화면 | 대상 | 내용 |
|---|---|---|
| 홈 | 그룹원 | 이번 달 가족 총지출, 사람별 지출, 예산 진행률, 카테고리 상위 항목, 최근 거래 5건 |
| 거래 목록 | 그룹원 | 월별 목록, 사람·카테고리 필터, 상단 예산 초과 배너, 거래별 카테고리·메모 수정 |
| 통계 | 그룹원 | 월별 추이, 카테고리 비중, 사람별 비교 |
| 미분류 문자 | 그룹원 | 원문 확인 → 거래로 등록 또는 무시 |
| 수동 입력 | 그룹원 | 금액, 가맹점, 일시, 사용자, 카테고리 |
| 내 기기 연결 | 그룹원 | 기기 선택 → 설정 안내 → 토큰(발급 시 한 번만 표시), 재발급·폐기, 마지막 수신 시각(3일 넘으면 경고) |
| 카테고리 | 그룹원 | 그룹 카테고리 추가·수정, 가맹점 규칙 관리 |
| 예산 | 그룹원 | 월 전체·카테고리별 예산 설정 |
| 그룹 | 그룹장 | 초대 링크 발급·취소, 구성원 |
| 운영자 | 운영자 | 서비스 초대 발급, 사용자 수 / 최대 인원, 그룹 목록 |
| 가입·로그인 | 모두 | Google 로그인, 초대 링크에서는 이름 확인 후 수락 |

**예산 표시**

- 사용률은 저장하지 않고, 해당 월 거래 합계(취소 반영)로 매번 계산한다.
- 사용률이 `budget_warning_ratio` 이상이면 경고 색으로 바꾸고, 100%를 넘으면 초과 금액을 함께 표시한다.
- 알림은 보내지 않는다.

## 7. 보안과 개인정보

- **RLS**: 모든 테이블에 적용한다. 다른 그룹 데이터를 읽거나 쓰려는 시도가 실패하는지 자동 테스트로 확인한다.
- **비밀값**
  - 실제 값은 `.env`에만 둔다. 저장소에는 키 이름만 있는 `.env.example`을 커밋한다.
  - 커밋 전에 비밀값 검사(gitleaks)를 실행한다.
- **외부 전송(TypeSafe)**: 카테고리 자동 분류에는 가맹점 이름과 카테고리 이름·설명만 보낸다. 금액·사람·날짜·문자 원문은 보내지 않는다. 키와 가맹점 이름은 로그에 남기지 않는다.
- **원문 마스킹**: 저장 전에 카드번호 일부·승인번호 등 식별 정보를 가린다.
- **원문 보관 기간**: `raw_message_retention_days`가 지난 원문은 삭제한다. 거래 데이터는 유지한다.
- **공개 저장소**: 실제 문자, 사이트 주소, NAS 접속 정보, 네트워크 설정은 커밋하지 않는다.

## 8. 오류 처리

| 상황 | 처리 |
|---|---|
| 문자 분석 실패 | `unparsed`로 보관하고 미분류 화면에 표시한다 |
| 같은 문자를 다시 받음 | `duplicate`로 응답하고 거래를 만들지 않는다 |
| 기기 전송이 멈춤 | 서버는 알 수 없다. 마지막 수신 시각이 3일 넘으면 화면에 경고하고, 빠진 거래는 수동 입력으로 보완한다 |
| 초대 만료·사용됨·인원 초과 | 사유별 안내 문구를 보여주고 계정·소속을 만들지 않는다 |
| 취소 원거래 없음 | 음수 단독 거래로 남긴다 |

## 9. 테스트

| 대상 | 방법 |
|---|---|
| 문자 분석기 | 가상화한 문자 픽스처로 단위 테스트: 승인, 취소, 후불교통 안내, 누적액 구분, 연도 경계 |
| DB | 로컬 Supabase(Docker)에서 RLS 격리, `accept_invite` 인원 제한·동시성, 중복 unique |
| ingest API | 정상, 중복, 잘못된·폐기된 토큰, 429, 형식 오류 |
| 화면 | Playwright: 가입 → 그룹 생성 → 초대 → 배우자 가입 → ingest → 거래·예산 표시 |
| 실기기 | 잠긴 아이폰, 화면 꺼진·절전 모드 갤럭시에서 실제 문자 전송 (배포 전 별도 검증) |

## 10. 개발과 배포

- **개발**: 로컬 Supabase CLI와 Next.js. 스키마 변경은 `supabase/migrations`에 SQL로 관리한다.
- **배포**: Docker 이미지 → NAS Container Manager. 외부 HTTPS 주소(Cloudflare Tunnel 또는 DDNS)는 배포 단계에서 승인을 받아 정한다.
- **작업 방식**: 단계마다 범위를 설명하고 승인을 받는다. 커밋도 승인 후 진행한다.

**구현 순서 (세부는 구현 계획 문서에서 정함)**

1. 프로젝트 기본 틀
2. DB 스키마와 RLS
3. 문자 분석기
4. ingest API
5. 인증과 초대
6. 화면
7. 예산
8. Docker와 배포

## 11. 미결 사항

- 잠긴 아이폰·절전 갤럭시에서 자동 전송이 되는지 실기기 검증
- 외부 HTTPS 방식 (Cloudflare Tunnel vs DDNS)
- Supabase 무료 플랜 제약(비활성 프로젝트 일시 중지) 최신 확인
- Google OAuth 클라이언트 생성(Google Cloud Console)과 Supabase 연결: 로컬은 계획 2, 클라우드는 계획 4
- GitHub 원격 저장소 연결 (네트워크 복구 후)
