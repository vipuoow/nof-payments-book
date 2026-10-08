# 거래 상세 · 새로 추가 · 밀어서 삭제 · 확인할 문자 작업 계획

**설계서:** docs/superpowers/specs/2026-10-08-tx-screens-design.md

## 목표

시안에서 정한 네 화면을 실제 홈에 넣는다.
- 거래 상세: 화면 전체로 커지고, 하수구처럼 닫힌다.
- 새로 추가: 한 칸씩 입력하고, 입력한 값이 위에 쌓인다.
- 밀어서 삭제
- 확인할 문자

## 구조

**화면**
- 홈(`src/app/page.tsx`)은 서버에서 그 달의 데이터와 확인할 문자 목록을 읽는다.
- 그 데이터를 클라이언트 컴포넌트 `HomeLedger`에 넘긴다.
- `HomeLedger`가 하는 일
  - 날짜별 목록을 그린다(줄 밀기 포함).
  - 겹쳐 뜨는 화면을 띄운다: 상세, 새로 추가, 확인할 문자, 지울지 묻는 창, 짧은 알림.

**주소**
- 겹쳐 뜨는 화면은 주소 값으로 정한다: `?tx=<id>`, `?add=1`(`&raw=<id>`), `?inbox=1`.
- 열 때는 `history.pushState`를 쓴다.
  - Next 라우터와 연동되므로 서버를 다시 부르지 않는다.
- 닫을 때는 뒤로 가기를 쓴다.
  - 휴대폰의 '뒤로'로도 닫히고, 닫히는 움직임도 똑같이 나온다.

**저장**
- 저장 동작은 이동하지 않는 서버 함수로 바꾼다. 결과 `{ ok } | { error }`를 돌려주고, 화면이 `router.refresh()`로 새 값을 받는다.
- 분류 바꾸기는 지금처럼 `set_transaction_category`를 쓴다(가게 규칙 학습 유지).

**옛 주소**
- `/new`는 `/?add=1`로 보낸다.
- `/new?raw=X`는 `/?add=1&raw=X`로 보낸다.
- `/unparsed`는 `/?inbox=1`로 보낸다.
- 옛 시트 컴포넌트는 지운다.

## 지켜야 할 것

- 사용자 문구는 설계서 그대로 쓴다.
- 입력칸 글자는 16px 이상이다(아이폰 확대 방지).
- 동작 줄이기 설정을 따른다.
- 공개 저장소에는 도메인·시안 주소를 쓰지 않는다.

## 검토에서 볼 곳

1. 직접 추가한 거래가 아니면 서버에서 금액·가게·언제·누가 수정을 거절하는가(화면을 거치지 않은 호출 포함)
2. 금액 칸에서 지우기·붙여넣기·0으로 시작·11자리 넘기가 바르게 처리되는가
3. 다른 달에 저장했을 때 그 달로 옮겨 가서 보이는가
4. 이미 처리된 문자를 다시 등록하거나 무시하면 거절하는가
5. 빠르게 두 번 누르거나 저장 중 닫을 때 두 번 저장되지 않는가

## 할 일

### 1. 순수 함수와 단위 테스트

- `src/ledger/won.ts`
  - `koWon(n)`: 13325 → "1만 3325"
  - `nextRawAmount(raw, inputType, data)`: 입력 한 번마다 실제 숫자를 계산한다. 최대 11자리이고, 앞의 0은 없앤다.
- `src/ledger/sms-guess.ts`
  - `guessFromSms(body, receivedAt)`: 문자에서 `{ amount?, merchant?, occurredAt? }`를 찾는다.
  - 누적 금액은 건너뛴다.
  - 국민카드 형식은 시각 다음 줄을 가게로 본다. 같은 줄 뒤에 글자가 있으면 그것을 가게로 본다.
- `src/ledger/when.ts`
  - `dayShortcuts(now)`: 오늘·어제·그저께의 날짜 값
  - `splitLocal` / `joinLocal`
- `src/ledger/forms.ts`
  - 항목별 검사 함수를 꺼낸다: `parseAmount`, `parseMerchant`, `parseOccurredAt`
  - `parseTxForm`은 그 함수들을 조합한다.
- 테스트는 실패를 먼저 보고 나서 구현한다.

### 2. 서버 함수 (`src/app/tx-actions.ts`)

- `updateTxField(txId, patch)`
  - 고칠 수 있는 항목: `amount | merchant | occurredAt | userId | categoryId`
  - 분류는 RPC로 바꾼다.
  - 나머지 항목은 직접 추가한 거래만 바꿀 수 있다. 아니면 "카드 문자로 들어온 거래는 분류만 고칠 수 있어요."를 돌려준다.
- `setOnnuri(txId, on)`
- `deleteTx(txId)`: 직접 추가한 거래만 지운다.
- `createTx(input)`: 저장 결과로 `{ ok, id, month }`를 돌려준다. 문자에서 왔으면 그 문자를 처리됨으로 바꾼다.
- `ignoreRaw(rawId)`
- 옛 폼용 액션과 옛 컴포넌트는 지운다.
- 테스트: e2e에서 화면을 거치지 않은 호출이 거절되는지 본다. DB 권한은 그대로다.

### 3. 화면

- `src/components/ledger/home-ledger.tsx`: 상태와 주소 동기화
- `tx-rows.tsx`: 줄 그리기와 밀기
- `tx-detail.tsx`: 상세
- `tx-question.tsx`: 질문 한 개(금액, 어디서, 분류, 언제, 누가)
- `add-flow.tsx`: 쌓이는 입력
- `inbox.tsx`: 확인할 문자
- `motion.ts`: 펼치기, 하수구로 닫기, 파문
- 스타일은 `globals.css`의 `.lx-*`

### 4. 홈과 옛 주소

- `page.tsx`에서 `HomeLedger`를 쓴다.
- `/new`와 `/unparsed`는 새 주소로 보낸다.
- `loadUnparsed`를 추가한다.

### 5. e2e

- 새로 쓰는 테스트: `e2e/tx-screens.spec.ts`
  - 상세를 열고 분류를 고치고 닫는다.
  - 카드 거래는 분류와 온누리만 고칠 수 있다.
  - 직접 추가한 거래는 금액을 고칠 수 있다.
  - 쌓이는 입력으로 저장한다(한글 금액 포함).
  - 밀어서 지운다.
  - 카드 줄을 밀면 알림이 뜬다.
  - 확인할 문자를 등록하고(미리 채움), 무시한다.
  - 뒤로 가기로 닫는다.
- 옛 시트·폼을 쓰는 테스트를 새 화면에 맞게 고친다: `category`, `categories`, `manual-unparsed`, `minor-fixes`, `review-fixes`, `home`, `onnuri`.

### 6. 확인·배포

- 전체 테스트를 돌린다: 단위, DB, e2e, lint, tsc.
- 별도 검토자가 검토한다.
- 커밋, push, v1.3.0 태그를 단다.
- NAS에서 새 버전으로 바꾸고 상태를 확인한다.
- `docs/status.md`를 고친다.
