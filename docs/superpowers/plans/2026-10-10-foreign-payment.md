# 해외 결제 · 환율 작업 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** 카드사와 관계없이 문자 속 통화 표시를 읽고, 국민·현대 해외 결제는 저장된 환율로 원화를 계산해 자동 기록한다.

**구조:** 순수 함수 `src/parsers/money.ts`(통화 금액 읽기)와 `src/parsers/foreign.ts`(해외 문자 줄 읽기)를 국민·현대 분석기와 미리 채우기·붙여넣기가 함께 쓴다. 환율은 `src/fx/`가 open.er-api.com에서 받아 `fx_rates` 표에 날짜별로 저장하고(앱 안 타이머, `src/instrumentation.ts`), 문자 수신 때 앱이 원화를 계산해 `ingest_sms`에 외화 칸과 함께 넘긴다. 해외 취소의 원화는 DB 함수가 짝지은 결제에서 가져온다.

**기술:** Next.js 16.3.7(App Router, `instrumentation.ts`), Supabase(Postgres·RLS), Vitest(단위 `src`, DB `tests/db`), Playwright(`e2e`).

**설계:** `docs/superpowers/specs/2026-10-10-foreign-payment-design.md`

## 전체 제약

- 통화 표시: 3글자 코드(앞·뒤·괄호), `$`/`달러`→USD, `€`/`유로`→EUR, `¥`/`엔`→JPY, `£`/`파운드`→GBP, `위안`→CNY, `동`→VND. 문자에 ISO 코드가 있으면 기호·한글보다 코드.
- `동`은 숫자 바로 뒤 + 같은 문자에 `승인`/`취소`가 있을 때만.
- `원` 금액이 있으면 원화 우선(외화는 참고로 저장, 계산 안 함). `누적` 줄은 건너뛴다.
- 예상 원화 = 외화 × 결제 날짜(KST) 환율, 원 단위 반올림, 수수료 없음.
- 환율: `https://open.er-api.com/v6/latest/KRW`, 매일 09:10 KST + 앱이 켜질 때 한 번. 출처 표시 `환율 제공: ExchangeRate-API`.
- 해외 결제(approval, currency 있음)만 카드 거래여도 금액 수정 가능, 고치면 `amount_estimated = false`.
- 화면 문구는 한국어. 금액 표시는 지금 앱처럼 `formatWon`(쉼표)을 쓴다: 목록 `약 10,739원` + 작은 글씨 `8 USD`(외화는 정수면 정수, 아니면 소수 둘째 자리)(설계 문서의 `약 1만 739원`은 예시이고 목록의 기존 표기를 따른다).
- 로컬 DB에 `supabase db reset` 금지. 마이그레이션은 `pnpm exec supabase migration up --local`.
- 커밋은 각 Task 끝에서 하되, push·태그·운영 DB 적용은 사용자 승인 후.

## 검토 초점

1. 대문자 3글자 가게 이름(`TOP 10`, `ALL 5,000원`)을 통화로 잘못 읽는 경우 — 원화가 있으면 원화가 이겨야 하고, ISO 목록 밖 글자는 무시해야 한다(Task 1 테스트).
2. 첫 환율을 받기 전 날짜의 결제(예: 10/02 결제, 환율은 10/10부터) — 그날 이전 값이 없으면 가장 가까운 이후 값을 써서 장부에 들어가야 한다(Task 4 테스트).
3. 환율 API가 실패하거나 엉뚱한 응답을 줄 때 — 저장하지 않고, 수신된 해외 문자는 확인할 문자로 가야 하며 앱이 죽지 않아야 한다(Task 4·5 테스트).
4. 해외 취소가 결제보다 먼저 오거나, 결제 금액을 사용자가 고친 뒤 취소가 올 때 — 취소 원화가 결제의 지금 원화와 같아야 한다(Task 3 테스트).
5. 국내 카드 거래 금액을 화면을 거치지 않고 바꾸려는 호출 — 여전히 거절되어야 한다(Task 3 테스트).

---

### Task 1: 통화 금액 읽기 `readMoney`

**Files:**
- Create: `src/parsers/money.ts`, `src/parsers/currencies.ts`
- Test: `src/parsers/money.test.ts`

**Interfaces:**
- Produces:
  - `type Foreign = { currency: string; foreignAmount: number }`
  - `type Money = { kind: "krw"; amount: number; foreign?: Foreign } | ({ kind: "foreign" } & Foreign)`
  - `readMoney(text: string): Money | null`
  - `ISO_CURRENCIES: ReadonlySet<string>` (KRW 포함)

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/parsers/money.test.ts
import { describe, expect, it } from "vitest";
import { readMoney } from "./money";

const fx = (currency: string, foreignAmount: number) => ({ kind: "foreign", currency, foreignAmount });

describe("readMoney", () => {
  it("원화", () => {
    expect(readMoney("12,300원 일시불")).toEqual({ kind: "krw", amount: 12300 });
  });
  it("누적 줄은 건너뛴다", () => {
    expect(readMoney("누적1,234,567원\n900원 일시불")).toEqual({ kind: "krw", amount: 900 });
  });
  it("코드 뒤·괄호, 코드 앞, 쉼표·소수, 정수", () => {
    expect(readMoney("8.00(USD) 10/02 09:08")).toEqual(fx("USD", 8));
    expect(readMoney("USD 8.00")).toEqual(fx("USD", 8));
    expect(readMoney("1,234.50 EUR")).toEqual(fx("EUR", 1234.5));
    expect(readMoney("1500(JPY)")).toEqual(fx("JPY", 1500));
  });
  it("기호와 한글", () => {
    expect(readMoney("$8.00")).toEqual(fx("USD", 8));
    expect(readMoney("€12.50")).toEqual(fx("EUR", 12.5));
    expect(readMoney("¥1500")).toEqual(fx("JPY", 1500));
    expect(readMoney("£9.99")).toEqual(fx("GBP", 9.99));
    expect(readMoney("20달러")).toEqual(fx("USD", 20));
    expect(readMoney("12.5유로")).toEqual(fx("EUR", 12.5));
    expect(readMoney("1,500엔")).toEqual(fx("JPY", 1500));
    expect(readMoney("30위안")).toEqual(fx("CNY", 30));
    expect(readMoney("9파운드")).toEqual(fx("GBP", 9));
  });
  it("코드가 있으면 기호보다 코드", () => {
    expect(readMoney("$12.00 CAD")).toEqual(fx("CAD", 12));
  });
  it("동은 승인·취소가 있을 때만", () => {
    expect(readMoney("해외승인\n150,000동")).toEqual(fx("VND", 150000));
    expect(readMoney("테스트아파트 101동 1203호")).toBeNull();
  });
  it("원화가 있으면 원화가 먼저, 외화는 참고", () => {
    expect(readMoney("해외승인\n10,739원\n8.00(USD)")).toEqual({
      kind: "krw", amount: 10739, foreign: { currency: "USD", foreignAmount: 8 },
    });
  });
  it("ISO 목록 밖 대문자 3글자는 통화가 아니다, 원화가 있으면 원화", () => {
    expect(readMoney("ABC 5,000")).toBeNull();
    expect(readMoney("ZERO 승인 2,600원")).toEqual({ kind: "krw", amount: 2600 });
    expect(readMoney("ALL 5,000원")).toMatchObject({ kind: "krw", amount: 5000 });
  });
  it("금액이 없거나 0이면 null", () => {
    expect(readMoney("인증번호 [123456]")).toBeNull();
    expect(readMoney("0.00(USD)")).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm vitest run src/parsers/money.test.ts` → 모듈 없음으로 실패.

- [ ] **Step 3: 구현**

```ts
// src/parsers/currencies.ts
/** ISO 4217 통화 코드(현재 쓰는 것). 문자 속 대문자 3글자를 통화로 볼지 정한다. */
export const ISO_CURRENCIES: ReadonlySet<string> = new Set((
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD " +
  "CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF " +
  "GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP " +
  "LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB " +
  "PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SYP SZL THB " +
  "TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL"
).split(" "));
```

```ts
// src/parsers/money.ts
import { ISO_CURRENCIES } from "./currencies";

export type Foreign = { currency: string; foreignAmount: number };
export type Money = { kind: "krw"; amount: number; foreign?: Foreign } | ({ kind: "foreign" } & Foreign);

const NUM = String.raw`([0-9][0-9,]*(?:\.[0-9]+)?)`;
const WON = /([0-9][0-9,]*)\s*원/;
const CODE_AFTER = new RegExp(String.raw`${NUM}\s*\(?\s*([A-Z]{3})(?![A-Za-z])`, "g");
const CODE_BEFORE = new RegExp(String.raw`(?<![A-Za-z])([A-Z]{3})\s*${NUM}`, "g");
const CODE_ANY = /(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g;
const SYMBOL = new RegExp(String.raw`([$€¥£])\s*${NUM}`);
const WORD = new RegExp(String.raw`${NUM}\s*(달러|유로|엔|파운드|위안|동)(?![가-힣])`);
const SYMBOL_CODE: Record<string, string> = { $: "USD", "€": "EUR", "¥": "JPY", "£": "GBP" };
const WORD_CODE: Record<string, string> = { 달러: "USD", 유로: "EUR", 엔: "JPY", 파운드: "GBP", 위안: "CNY", 동: "VND" };

const num = (s: string) => Number(s.replaceAll(",", ""));
const ok = (n: number) => Number.isFinite(n) && n > 0;
const isForeignCode = (c: string) => c !== "KRW" && ISO_CURRENCIES.has(c);

function readForeign(text: string): Foreign | null {
  for (const m of text.matchAll(CODE_AFTER)) {
    if (isForeignCode(m[2]) && ok(num(m[1]))) return { currency: m[2], foreignAmount: num(m[1]) };
  }
  for (const m of text.matchAll(CODE_BEFORE)) {
    if (isForeignCode(m[1]) && ok(num(m[2]))) return { currency: m[1], foreignAmount: num(m[2]) };
  }
  const code = [...text.matchAll(CODE_ANY)].map((m) => m[1]).find(isForeignCode);
  const sym = SYMBOL.exec(text);
  if (sym && ok(num(sym[2]))) return { currency: code ?? SYMBOL_CODE[sym[1]], foreignAmount: num(sym[2]) };
  const word = WORD.exec(text);
  if (word && ok(num(word[1]))) {
    if (word[2] === "동" && !/승인|취소/.test(text)) return null;
    return { currency: code ?? WORD_CODE[word[2]], foreignAmount: num(word[1]) };
  }
  return null;
}

/**
 * 문자에서 결제 금액을 찾는다. `원` 금액이 있으면 원화(외화 표시는 참고로 함께), 없으면 외화.
 * `누적`이 들어간 줄은 보지 않는다.
 */
export function readMoney(text: string): Money | null {
  const body = text.split(/\r?\n/).filter((l) => !l.includes("누적")).join("\n");
  const foreign = readForeign(body);
  const won = WON.exec(body);
  if (won && ok(num(won[1])) && Number.isSafeInteger(num(won[1]))) {
    return foreign ? { kind: "krw", amount: num(won[1]), foreign } : { kind: "krw", amount: num(won[1]) };
  }
  return foreign ? { kind: "foreign", ...foreign } : null;
}
```

- [ ] **Step 4: 통과 확인** — `pnpm vitest run src/parsers/money.test.ts` → PASS.

- [ ] **Step 5: 커밋** — `git add src/parsers/money.ts src/parsers/currencies.ts src/parsers/money.test.ts && git commit -m "feat: 문자 속 통화 금액 읽기(readMoney)"`

---

### Task 2: 국민·현대 해외 문자 분석

**Files:**
- Create: `src/parsers/foreign.ts`, `src/parsers/foreign.test.ts`
- Modify: `src/parsers/types.ts`, `src/parsers/kb-card.ts`, `src/parsers/hyundai-card.ts`, `src/parsers/__fixtures__/kb-card.ts`, `src/parsers/__fixtures__/hyundai-card.ts`, `src/parsers/kb-card.test.ts`, `src/parsers/hyundai-card.test.ts`

**Interfaces:**
- Consumes: `readMoney`, `Foreign` (Task 1)
- Produces:
  - `ParseResult`의 결제 변형이 `{ kind: "approval" | "cancel"; amount: number | null; foreign?: Foreign; merchant; occurredAt; issuer }`로 바뀐다. `amount === null`이면 `foreign`이 반드시 있다(원화 계산 필요). 원화 결제는 지금처럼 `amount: number`, `foreign` 없음.
  - `readForeignCard(lines: string[], receivedAt: Date): Omit<Payment, "issuer"> | null` (`Payment`는 types.ts에서 export)

- [ ] **Step 1: 픽스처 추가**

```ts
// src/parsers/__fixtures__/kb-card.ts 끝에 추가
export const FOREIGN_APPROVAL = `[Web발신]
KB국민카드1234 해외승인
8.00(USD) 10/02 09:08
미국 typesafe a`;

export const FOREIGN_CANCEL = `[Web발신]
KB국민카드1234 해외취소
8.00(USD) 10/03 10:00
미국 typesafe a`;

export const FOREIGN_WITH_WON = `[Web발신]
KB국민카드1234 해외승인
10,739원 10/02 09:08
미국 typesafe a`;
```

```ts
// src/parsers/__fixtures__/hyundai-card.ts 끝에 추가(예시 없음 — 국민카드와 같은 배치로 가정한 가상 문자)
export const FOREIGN_APPROVAL = `[Web발신]
현대 ZERO 해외승인
홍*동
12.50(EUR)
10/04 21:15
테스트카페 파리점`;
```

- [ ] **Step 2: 실패하는 테스트**

```ts
// src/parsers/foreign.test.ts
import { describe, expect, it } from "vitest";
import { kbCardParser } from "./kb-card";
import { hyundaiCardParser } from "./hyundai-card";
import { FOREIGN_APPROVAL, FOREIGN_CANCEL, FOREIGN_WITH_WON } from "./__fixtures__/kb-card";
import { FOREIGN_APPROVAL as HD_FOREIGN } from "./__fixtures__/hyundai-card";

const received = new Date("2026-10-05T12:00:00+09:00");

describe("해외 문자", () => {
  it("국민 해외승인: 외화·시각·가게(나라 뗌), 원화는 아직 없음", () => {
    expect(kbCardParser.parse(FOREIGN_APPROVAL, received)).toEqual({
      kind: "approval", amount: null, foreign: { currency: "USD", foreignAmount: 8 },
      merchant: "typesafe a", occurredAt: new Date("2026-10-02T09:08:00+09:00"), issuer: "kb",
    });
  });
  it("국민 해외취소", () => {
    expect(kbCardParser.parse(FOREIGN_CANCEL, received)).toMatchObject({ kind: "cancel", amount: null, foreign: { currency: "USD", foreignAmount: 8 } });
  });
  it("원화가 찍힌 해외 문자는 원화 그대로(외화 없음)", () => {
    expect(kbCardParser.parse(FOREIGN_WITH_WON, received)).toMatchObject({ kind: "approval", amount: 10739, merchant: "typesafe a" });
  });
  it("현대 해외승인(가정한 배치)", () => {
    expect(hyundaiCardParser.parse(HD_FOREIGN, received)).toEqual({
      kind: "approval", amount: null, foreign: { currency: "EUR", foreignAmount: 12.5 },
      merchant: "테스트카페 파리점", occurredAt: new Date("2026-10-04T21:15:00+09:00"), issuer: "hyundai",
    });
  });
  it("시각이 없으면 unknown", () => {
    expect(kbCardParser.parse("KB국민카드1234 해외승인\n8.00(USD)\n미국 typesafe a", received)).toEqual({ kind: "unknown" });
  });
});
```

- [ ] **Step 3: 실패 확인** — `pnpm vitest run src/parsers/foreign.test.ts` → 실패.

- [ ] **Step 4: 구현**

```ts
// src/parsers/types.ts — 결제 변형을 이름 붙여 내보낸다
import type { Foreign } from "./money";

export type Payment = {
  kind: "approval" | "cancel";
  /** 원화 결제·취소 금액(항상 양수). 외화만 있으면 null(원화는 환율로 계산) */
  amount: number | null;
  /** 외화 금액. amount가 null이면 반드시 있다. 원화가 있으면 참고용 */
  foreign?: Foreign;
  merchant: string;
  occurredAt: Date;
  issuer: string;
};

export type ParseResult = Payment | { kind: "ignore"; reason: string } | { kind: "unknown" };
```

```ts
// src/parsers/foreign.ts
import { inferYear, isValidKstDateTime, kstDate } from "./kst";
import { readMoney } from "./money";
import type { Payment } from "./types";

const DATETIME = /(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/;
const COUNTRY = /^[가-힣]+\s+(.+)$/;

/** 해외 형식(머리 줄에 해외승인/해외취소, 또는 외화 금액)인지 */
export function looksForeign(lines: string[]): boolean {
  if (/해외(승인|취소)/.test(lines[0] ?? "")) return true;
  return readMoney(lines.join("\n"))?.kind === "foreign";
}

/**
 * 해외 결제 문자: 종류는 머리 줄의 승인/취소, 금액은 readMoney, 시각은 MM/DD HH:mm,
 * 가게는 시각 뒤 같은 줄 또는 다음 줄. 가게 앞의 나라 이름(한글 한 단어)은 뗀다.
 */
export function readForeignCard(lines: string[], receivedAt: Date): Omit<Payment, "issuer"> | null {
  const head = /(승인|취소)/.exec(lines[0] ?? "");
  const money = readMoney(lines.join("\n"));
  const i = lines.findIndex((l) => DATETIME.test(l));
  if (!head || !money || i < 0) return null;
  const m = DATETIME.exec(lines[i])!;
  const [month, day, hour, minute] = m.slice(1, 5).map(Number);
  const year = inferYear(month, receivedAt);
  if (!isValidKstDateTime(year, month, day, hour, minute)) return null;
  const after = lines[i].slice(m.index + m[0].length).trim();
  const next = lines[i + 1];
  const raw = after && !readMoney(after) ? after : next && !next.includes("누적") && !readMoney(next) ? next : "";
  if (!raw) return null;
  const merchant = (COUNTRY.exec(raw)?.[1] ?? raw).slice(0, 100);
  const kind = head[1] === "승인" ? "approval" : "cancel";
  const occurredAt = kstDate(year, month, day, hour, minute);
  return money.kind === "krw"
    ? { kind, amount: money.amount, merchant, occurredAt }
    : { kind, amount: null, foreign: { currency: money.currency, foreignAmount: money.foreignAmount }, merchant, occurredAt };
}
```

`kb-card.ts`의 `parse` 맨 앞(후불교통 검사 다음)에:

```ts
    if (looksForeign(ls)) {
      const f = readForeignCard(ls, receivedAt);
      return f ? { ...f, issuer: "kb" } : { kind: "unknown" };
    }
```

`hyundai-card.ts`의 `parse` 맨 앞에 같은 블록(`issuer: "hyundai"`). 두 파일에 `import { looksForeign, readForeignCard } from "./foreign";`.

주의: 국내 문자 `12,300원 일시불`은 `looksForeign`이 거짓(원화)이므로 기존 경로 그대로다. 현대 픽스처 `현대 ZERO 해외승인`의 가게 줄은 `홍*동`이 아니라 시각 다음 줄이다(시각 줄 기준).

- [ ] **Step 5: 기존 소비자 타입 맞추기** — `amount`가 `number | null`이 되어 `src/ingest/service.ts`, `src/ledger/paste-sms.ts`에서 타입 오류가 난다. 이 Task에서는 컴파일만 되게 최소로 고친다:
  - `paste-sms.ts`: `if (result.kind === "approval" && result.amount !== null) { ...지금 코드 }` (외화는 Task 6에서 처리)
  - `service.ts`: `const payment = (result.kind === "approval" || result.kind === "cancel") && result.amount !== null ? result : null;` 그리고 `p_amount: payment?.amount ?? null` 유지(외화는 Task 5).

- [ ] **Step 6: 통과 확인** — `pnpm vitest run src/parsers src/ledger` 와 `pnpm exec tsc --noEmit` → 모두 통과(기존 국민·현대 테스트 포함).

- [ ] **Step 7: 커밋** — `git commit -m "feat: 국민·현대 해외승인·해외취소 문자 읽기"`

---

### Task 3: DB — 외화 칸, 환율 표, 수정 규칙, ingest_sms

**Files:**
- Create: `supabase/migrations/20261010000000_foreign_payment.sql`, `tests/db/foreign.db.test.ts`

**Interfaces:**
- Produces:
  - `transactions.currency text`, `foreign_amount numeric`, `fx_rate numeric`, `amount_estimated boolean not null default false`
  - 표 `fx_rates(date date pk, base text, rates jsonb, fetched_at timestamptz)` — 읽기 authenticated, 쓰기 service_role
  - `ingest_sms(..., p_issuer, p_currency text default null, p_foreign_amount numeric default null, p_fx_rate numeric default null, p_amount_estimated boolean default false)`
  - 해외 취소: 같은 사람·카드사·통화·외화 금액·가게의 60일 안 결제와 짝, 취소 원화 = −(짝 결제의 지금 원화). 해외 결제가 늦게 오면 먼저 온 해외 취소의 원화를 −결제 원화로 맞춘다.

- [ ] **Step 1: 실패하는 DB 테스트**

```ts
// tests/db/foreign.db.test.ts
import { describe, expect, it } from "vitest";
import { adminClient, createGroupFixture } from "../helpers/db";

const db = adminClient();
let n = 0;
async function ingest(g: { groupId: string; owner: { userId: string } }, a: Record<string, unknown>) {
  const { data, error } = await db.rpc("ingest_sms", {
    p_group: g.groupId, p_user: g.owner.userId, p_body: `foreign-${Date.now()}-${n++}`, p_body_hash: `h-${Date.now()}-${n++}`,
    p_source: "manual_test", p_received_at: new Date().toISOString(), p_status: "parsed", p_parser_id: "kb-card",
    p_merchant: "typesafe a", p_issuer: "kb", ...a,
  });
  if (error) throw error;
  return data as { status: string; transaction_id: string };
}
const tx = async (id: string) => (await db.from("transactions").select("*").eq("id", id).single()).data!;

describe("해외 결제 저장", () => {
  it("외화 칸과 예상 표시를 저장한다", async () => {
    const g = await createGroupFixture("fx1");
    const r = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    expect(await tx(r.transaction_id)).toMatchObject({ amount: 10739, currency: "USD", foreign_amount: 8, fx_rate: 1342.34, amount_estimated: true });
  });

  it("해외 취소는 짝지은 결제의 지금 원화(고친 값)를 쓴다", async () => {
    const g = await createGroupFixture("fx2");
    const a = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    await db.from("transactions").update({ amount: 11000 }).eq("id", a.transaction_id);
    const c = await ingest(g, { p_kind: "cancel", p_amount: 10800, p_occurred_at: "2026-10-03T01:00:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1350, p_amount_estimated: true });
    expect(await tx(c.transaction_id)).toMatchObject({ amount: -11000, cancels_transaction_id: a.transaction_id });
  });

  it("해외 취소가 먼저 오면, 결제가 올 때 취소 원화를 결제 원화로 맞춘다", async () => {
    const g = await createGroupFixture("fx3");
    const c = await ingest(g, { p_kind: "cancel", p_amount: 10800, p_occurred_at: "2026-10-03T01:00:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1350, p_amount_estimated: true });
    const a = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    expect(await tx(c.transaction_id)).toMatchObject({ amount: -10739, cancels_transaction_id: a.transaction_id });
  });
});

describe("카드 거래 금액 고치기", () => {
  it("해외 결제는 금액만 고칠 수 있고, 고치면 예상 표시가 꺼진다", async () => {
    const g = await createGroupFixture("fx4");
    const a = await ingest(g, { p_kind: "approval", p_amount: 10739, p_occurred_at: "2026-10-02T00:08:00Z",
      p_currency: "USD", p_foreign_amount: 8, p_fx_rate: 1342.34, p_amount_estimated: true });
    const { error } = await g.owner.client.from("transactions").update({ amount: 11000 }).eq("id", a.transaction_id);
    expect(error).toBeNull();
    expect(await tx(a.transaction_id)).toMatchObject({ amount: 11000, amount_estimated: false });
    const bad = await g.owner.client.from("transactions").update({ foreign_amount: 9 }).eq("id", a.transaction_id);
    expect(bad.error?.message).toContain("card_tx_locked");
  });

  it("국내 카드 거래 금액은 여전히 거절", async () => {
    const g = await createGroupFixture("fx5");
    const a = await ingest(g, { p_kind: "approval", p_amount: 5000, p_occurred_at: "2026-10-02T00:08:00Z" });
    const { error } = await g.owner.client.from("transactions").update({ amount: 6000 }).eq("id", a.transaction_id);
    expect(error?.message).toContain("card_tx_locked");
  });
});

describe("fx_rates 권한", () => {
  it("로그인한 사용자는 읽기만", async () => {
    const g = await createGroupFixture("fx6");
    await db.from("fx_rates").upsert({ date: "2026-10-01", base: "KRW", rates: { USD: 0.00075 } });
    const read = await g.owner.client.from("fx_rates").select("date").eq("date", "2026-10-01");
    expect(read.data).toHaveLength(1);
    const write = await g.owner.client.from("fx_rates").insert({ date: "2026-09-01", base: "KRW", rates: {} });
    expect(write.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm test:db tests/db/foreign.db.test.ts` → 칸·표 없음으로 실패.

- [ ] **Step 3: 마이그레이션 작성** `supabase/migrations/20261010000000_foreign_payment.sql`

```sql
-- 해외 결제: 외화 칸, 날짜별 환율 표, 해외 결제 금액 고치기 허용, ingest_sms 외화 인자와 해외 취소 짝짓기.

alter table public.transactions
  add column currency text check (currency ~ '^[A-Z]{3}$'),
  add column foreign_amount numeric check (foreign_amount > 0),
  add column fx_rate numeric check (fx_rate > 0),
  add column amount_estimated boolean not null default false,
  add constraint transactions_foreign_pair check ((currency is null) = (foreign_amount is null));

create table public.fx_rates (
  date date primary key,
  base text not null,
  rates jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy fx_rates_read on public.fx_rates for select to authenticated using (true);
revoke insert, update, delete on public.fx_rates from anon, authenticated;

-- 카드 거래 보호: 해외 결제(approval, currency 있음)의 금액만 바꿀 수 있고, 바꾸면 예상 표시를 끈다.
-- 외화 칸은 아무도(앱 사용자) 바꿀 수 없다.
create or replace function public.guard_card_transaction()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' or old.kind = 'manual' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'card_tx_locked' using errcode = '42501';
  end if;
  if new.amount is distinct from old.amount then
    if old.currency is null or old.kind <> 'approval' or new.amount <= 0 then
      raise exception 'card_tx_locked' using errcode = '42501';
    end if;
    new.amount_estimated := false;
  end if;
  if new.merchant is distinct from old.merchant
     or new.occurred_at is distinct from old.occurred_at or new.user_id is distinct from old.user_id
     or new.kind is distinct from old.kind or new.currency is distinct from old.currency
     or new.foreign_amount is distinct from old.foreign_amount or new.fx_rate is distinct from old.fx_rate
     or (new.amount_estimated is distinct from old.amount_estimated and new.amount is not distinct from old.amount) then
    raise exception 'card_tx_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop function public.ingest_sms(uuid, uuid, text, text, text, timestamptz, text, text, text, bigint, text, timestamptz, text);

-- 20261007000000_cancel_match_issuer.sql의 ingest_sms에 외화 인자 4개를 더했다.
-- 해외 취소(p_currency 있음)는 원화 대신 통화·외화 금액으로 짝을 찾고, 짝의 지금 원화를 쓴다.
create function public.ingest_sms(
  p_group uuid, p_user uuid, p_body text, p_body_hash text, p_source text, p_received_at timestamptz,
  p_status text, p_parser_id text,
  p_kind text default null, p_amount bigint default null, p_merchant text default null,
  p_occurred_at timestamptz default null, p_issuer text default null,
  p_currency text default null, p_foreign_amount numeric default null,
  p_fx_rate numeric default null, p_amount_estimated boolean default false
) returns jsonb
language plpgsql set search_path = public
as $$
declare
  v_duplicate boolean;
  v_raw_id uuid;
  v_category_id uuid;
  v_category_source text;
  v_cancels_id uuid;
  v_amount bigint := p_amount;
  v_early_cancel_id uuid;
  v_early_category_id uuid;
  v_early_category_source text;
  v_tx_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  if p_kind = 'approval' then
    select exists (
      select 1 from public.raw_messages r
      where r.user_id = p_user and r.body_hash = p_body_hash
        and not exists (
          select 1 from public.transactions t
          join public.transactions c on c.cancels_transaction_id = t.id
          where t.raw_message_id = r.id and t.kind = 'approval'
        )
    ) into v_duplicate;
  else
    select exists (
      select 1 from public.raw_messages r where r.user_id = p_user and r.body_hash = p_body_hash
    ) into v_duplicate;
  end if;
  if v_duplicate then
    return jsonb_build_object('status', 'duplicate');
  end if;

  insert into public.raw_messages (group_id, user_id, body, body_hash, source, received_at, status, parser_id)
  values (p_group, p_user, p_body, p_body_hash, p_source, p_received_at, p_status, p_parser_id)
  returning id into v_raw_id;

  if p_kind is null then
    return jsonb_build_object('status', p_status);
  end if;

  select category_id into v_category_id
  from public.merchant_rules where group_id = p_group and merchant_pattern = p_merchant;
  if v_category_id is not null then
    v_category_source := 'rule';
  end if;

  if p_kind = 'cancel' then
    if p_currency is null then
      v_cancels_id := public.find_cancel_target(p_group, p_user, p_amount, p_merchant, p_occurred_at, p_issuer);
    else
      select t.id, t.amount into v_cancels_id, v_amount
      from public.transactions t
      where t.group_id = p_group and t.user_id = p_user and t.kind = 'approval'
        and t.currency = p_currency and t.foreign_amount = p_foreign_amount
        and t.merchant = p_merchant and t.issuer is not distinct from p_issuer
        and t.occurred_at <= p_occurred_at and t.occurred_at > p_occurred_at - interval '60 days'
        and not exists (select 1 from public.transactions c where c.cancels_transaction_id = t.id)
      order by t.occurred_at desc
      limit 1;
      v_amount := coalesce(v_amount, p_amount);
    end if;
    if v_category_id is null and v_cancels_id is not null then
      select category_id, category_source into v_category_id, v_category_source
      from public.transactions where id = v_cancels_id;
    end if;
  end if;

  if p_kind = 'approval' then
    select c.id, c.category_id, c.category_source
      into v_early_cancel_id, v_early_category_id, v_early_category_source
    from public.transactions c
    where c.group_id = p_group and c.user_id = p_user and c.kind = 'cancel'
      and c.cancels_transaction_id is null
      and c.merchant = p_merchant and c.issuer is not distinct from p_issuer
      and c.occurred_at >= p_occurred_at and c.occurred_at < p_occurred_at + interval '60 days'
      and case when p_currency is null
            then c.currency is null and c.amount = -p_amount
            else c.currency = p_currency and c.foreign_amount = p_foreign_amount end
    order by c.occurred_at
    limit 1;
    if v_category_id is null and v_early_category_id is not null then
      v_category_id := v_early_category_id;
      v_category_source := v_early_category_source;
    end if;
  end if;

  insert into public.transactions (
    group_id, user_id, raw_message_id, kind, amount, merchant, occurred_at, issuer,
    category_id, category_source, cancels_transaction_id,
    currency, foreign_amount, fx_rate, amount_estimated
  ) values (
    p_group, p_user, v_raw_id, p_kind,
    case when p_kind = 'cancel' then -v_amount else v_amount end,
    p_merchant, p_occurred_at, p_issuer, v_category_id, v_category_source, v_cancels_id,
    p_currency, p_foreign_amount, p_fx_rate, coalesce(p_amount_estimated, false)
  )
  returning id into v_tx_id;

  if v_early_cancel_id is not null then
    update public.transactions
    set cancels_transaction_id = v_tx_id,
        amount = case when p_currency is null then amount else -v_amount end,
        category_id = coalesce(category_id, v_category_id),
        category_source = case when category_id is null then v_category_source else category_source end
    where id = v_early_cancel_id;
  end if;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;
```

먼저 `grep -n "ingest_sms" supabase/migrations/*.sql`로 기존 `ingest_sms`의 `revoke/grant` 줄을 찾아, 새 함수 시그니처(인자 17개)로 같은 권한을 이 파일 끝에 다시 건다(예: `revoke execute on function public.ingest_sms(uuid, uuid, text, text, text, timestamptz, text, text, text, bigint, text, timestamptz, text, text, numeric, numeric, boolean) from public, anon, authenticated; grant ... to service_role;`). `fx_rates`의 기본 권한은 `tests/db/rls.db.test.ts`·`20261001000100_rls.sql`이 표를 어떻게 다루는지 보고 같은 방식으로 맞춘다.

- [ ] **Step 4: 적용·통과 확인** — `pnpm exec supabase migration up --local` → `pnpm test:db` 전체 통과(기존 ingest·tx-edit·rls 포함). `schema.db.test.ts`가 표 목록을 고정해 두었다면 `fx_rates`를 더한다.

- [ ] **Step 5: 커밋** — `git commit -m "feat(db): 외화 칸·환율 표·해외 결제 금액 고치기·해외 취소 짝짓기"`

---

### Task 4: 환율 받기·저장·조회 (`src/fx`)

**Files:**
- Create: `src/fx/rates.ts`, `src/fx/rates.test.ts`, `src/fx/store.ts`, `tests/db/fx-store.db.test.ts`

**Interfaces:**
- Produces:
  - `parseErApi(json: unknown): { date: string; rates: Record<string, number> } | null` — `result === "success"`, `base_code === "KRW"`, 숫자 rates만. `date` = `time_last_update_unix`의 KST 날짜 `YYYY-MM-DD`.
  - `kstDateKey(d: Date): string`
  - `krwPerUnit(rates: Record<string, number>, currency: string): number | null` — `1 / rates[currency]`, 소수 넷째 자리 반올림.
  - `toKrw(foreignAmount: number, krwPer: number): number` — `Math.round`.
  - `FX_URL = "https://open.er-api.com/v6/latest/KRW"`
  - (store, server-only) `fetchAndStoreRates(db, fetchFn = fetch): Promise<boolean>`
  - (store) `rateFor(db, currency, at: Date, fetchFn = fetch): Promise<{ krwPer: number; date: string } | null>` — 그날(KST) 이하 가장 가까운 날 → 없으면 가장 가까운 이후 날 → 표가 비었으면 한 번 받아 다시 찾기. 통화가 그 날 rates에 없으면 null.
  - (store) `latestRateDate(db): Promise<string | null>`

- [ ] **Step 1: 단위 테스트(순수 함수)**

```ts
// src/fx/rates.test.ts
import { describe, expect, it } from "vitest";
import { kstDateKey, krwPerUnit, parseErApi, toKrw } from "./rates";

const SAMPLE = { result: "success", base_code: "KRW", time_last_update_unix: 1759968001, rates: { KRW: 1, USD: 0.000745, JPY: 0.1102 } };

describe("환율", () => {
  it("응답 견본을 읽는다(날짜는 KST)", () => {
    expect(parseErApi(SAMPLE)).toEqual({ date: kstDateKey(new Date(1759968001 * 1000)), rates: SAMPLE.rates });
  });
  it("실패·형식 다름은 null", () => {
    expect(parseErApi({ result: "error" })).toBeNull();
    expect(parseErApi({ ...SAMPLE, base_code: "USD" })).toBeNull();
    expect(parseErApi({ ...SAMPLE, rates: { USD: "x" } })).toBeNull();
    expect(parseErApi(null)).toBeNull();
  });
  it("1단위 원화와 반올림", () => {
    expect(krwPerUnit(SAMPLE.rates, "USD")).toBe(1342.2819);
    expect(krwPerUnit(SAMPLE.rates, "EUR")).toBeNull();
    expect(toKrw(8, 1342.34)).toBe(10739);
  });
  it("KST 날짜", () => {
    expect(kstDateKey(new Date("2026-10-09T15:30:00Z"))).toBe("2026-10-10");
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm vitest run src/fx` → 실패.

- [ ] **Step 3: 구현**

```ts
// src/fx/rates.ts
export const FX_URL = "https://open.er-api.com/v6/latest/KRW";
export const FX_SOURCE = "환율 제공: ExchangeRate-API";

export function kstDateKey(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function parseErApi(json: unknown): { date: string; rates: Record<string, number> } | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;
  if (j.result !== "success" || j.base_code !== "KRW" || typeof j.time_last_update_unix !== "number") return null;
  if (typeof j.rates !== "object" || j.rates === null) return null;
  const rates = j.rates as Record<string, unknown>;
  if (!Object.values(rates).every((v) => typeof v === "number" && v > 0)) return null;
  return { date: kstDateKey(new Date(j.time_last_update_unix * 1000)), rates: rates as Record<string, number> };
}

export function krwPerUnit(rates: Record<string, number>, currency: string): number | null {
  const r = rates[currency];
  return r ? Math.round((1 / r) * 10000) / 10000 : null;
}

export const toKrw = (foreignAmount: number, krwPer: number) => Math.round(foreignAmount * krwPer);
```

```ts
// src/fx/store.ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FX_URL, kstDateKey, krwPerUnit, parseErApi } from "./rates";

type Fetch = typeof fetch;

/** 오늘 환율을 받아 날짜별로 저장(같은 날은 덮어씀). 실패하면 저장하지 않고 false */
export async function fetchAndStoreRates(db: SupabaseClient, fetchFn: Fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(FX_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return false;
    const parsed = parseErApi(await res.json());
    if (!parsed) return false;
    const { error } = await db.from("fx_rates").upsert({ date: parsed.date, base: "KRW", rates: parsed.rates, fetched_at: new Date().toISOString() });
    return !error;
  } catch {
    return false;
  }
}

async function nearest(db: SupabaseClient, day: string) {
  const before = await db.from("fx_rates").select("date, rates").lte("date", day).order("date", { ascending: false }).limit(1);
  if (before.data?.length) return before.data[0];
  const after = await db.from("fx_rates").select("date, rates").gt("date", day).order("date").limit(1);
  return after.data?.[0] ?? null;
}

/** 결제 날짜(KST)의 1단위 원화. 그날 이전 → 이후 → 표가 비면 한 번 받아 다시 */
export async function rateFor(db: SupabaseClient, currency: string, at: Date, fetchFn: Fetch = fetch) {
  const day = kstDateKey(at);
  let row = await nearest(db, day);
  if (!row && (await fetchAndStoreRates(db, fetchFn))) row = await nearest(db, day);
  if (!row) return null;
  const krwPer = krwPerUnit(row.rates as Record<string, number>, currency);
  return krwPer ? { krwPer, date: row.date as string } : null;
}

export async function latestRateDate(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("fx_rates").select("date").order("date", { ascending: false }).limit(1);
  return data?.[0]?.date ?? null;
}
```

- [ ] **Step 4: DB 테스트(가짜 fetch)**

```ts
// tests/db/fx-store.db.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { fetchAndStoreRates, rateFor } from "@/fx/store";
import { adminClient } from "../helpers/db";

const db = adminClient();
const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch;
const SAMPLE = (unix: number, usd: number) => ({ result: "success", base_code: "KRW", time_last_update_unix: unix, rates: { KRW: 1, USD: usd } });

describe("환율 저장·조회", () => {
  beforeEach(async () => { await db.from("fx_rates").delete().gte("date", "1900-01-01"); });

  it("저장하고 그날 이전 값을 쓴다", async () => {
    expect(await fetchAndStoreRates(db, ok(SAMPLE(1759968001, 0.0008)))).toBe(true);
    const r = await rateFor(db, "USD", new Date("2026-12-01T00:00:00Z"), ok({}));
    expect(r?.krwPer).toBe(1250);
  });
  it("이전 값이 없으면 가장 가까운 이후 값", async () => {
    await fetchAndStoreRates(db, ok(SAMPLE(1759968001, 0.0008)));
    expect((await rateFor(db, "USD", new Date("2020-01-01T00:00:00Z"), ok({})))?.krwPer).toBe(1250);
  });
  it("표가 비면 한 번 받아 쓰고, 실패하면 null", async () => {
    expect(await rateFor(db, "USD", new Date(), ok({ result: "error" }))).toBeNull();
    expect((await rateFor(db, "USD", new Date(), ok(SAMPLE(1759968001, 0.0008))))?.krwPer).toBe(1250);
  });
  it("응답 오류·네트워크 실패는 저장하지 않는다", async () => {
    const boom = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    expect(await fetchAndStoreRates(db, boom)).toBe(false);
    expect((await db.from("fx_rates").select("date")).data).toHaveLength(0);
  });
});
```

`server-only`를 DB 테스트에서 import하면 오류가 나면 `vitest.config.ts`가 이미 다른 server-only 모듈(예: `src/ledger/queries.ts`)을 어떻게 처리하는지 보고 같은 방식(별칭)을 쓴다.

- [ ] **Step 5: 통과 확인** — `pnpm vitest run src/fx && pnpm test:db tests/db/fx-store.db.test.ts` → PASS. 주의: 이 DB 테스트는 `fx_rates`를 비우므로 다른 DB 테스트(Task 5)는 자기 환율을 직접 넣는다.

- [ ] **Step 6: 커밋** — `git commit -m "feat: 환율 받기·저장·결제일 환율 찾기"`

---

### Task 5: 문자 수신에서 원화 계산

**Files:**
- Modify: `src/ingest/service.ts`, `tests/db/ingest-service.db.test.ts`

**Interfaces:**
- Consumes: `Payment`(Task 2), `rateFor`, `toKrw`(Task 4), `ingest_sms` 새 인자(Task 3)
- Produces: `ingestMessage(db, owner, input, fetchFn?: typeof fetch)` — 외화 결제는 환율로 원화 계산해 `parsed`, 환율을 못 구하면 `unparsed`(확인할 문자).

- [ ] **Step 1: 실패하는 테스트** (`tests/db/ingest-service.db.test.ts` 끝에 추가)

```ts
import { FOREIGN_APPROVAL } from "@/parsers/__fixtures__/kb-card";

describe("해외 결제 수신", () => {
  const recv = new Date("2026-10-05T12:00:00+09:00");
  it("저장된 환율로 원화를 계산해 기록한다", async () => {
    await db.from("fx_rates").upsert({ date: "2026-10-02", base: "KRW", rates: { KRW: 1, USD: 0.000745 } });
    const g = await createGroupFixture("fxin");
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: FOREIGN_APPROVAL, receivedAt: recv, source });
    expect(r.status).toBe("parsed");
    const { data } = await db.from("transactions").select("amount, currency, foreign_amount, fx_rate, amount_estimated, merchant").eq("id", r.transactionId!).single();
    expect(data).toMatchObject({ amount: 10738, currency: "USD", foreign_amount: 8, fx_rate: 1342.2819, amount_estimated: true, merchant: "typesafe a" });
  });
  it("환율이 없고 받기도 실패하면 확인할 문자", async () => {
    await db.from("fx_rates").delete().gte("date", "1900-01-01");
    const g = await createGroupFixture("fxno");
    const fail = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    const r = await ingestMessage(db, { userId: g.owner.userId, groupId: g.groupId }, { body: FOREIGN_APPROVAL, receivedAt: recv, source }, fail);
    expect(r.status).toBe("unparsed");
  });
});
```

(8 × 1342.2819 = 10738.26 → 10738.)

- [ ] **Step 2: 실패 확인** — `pnpm test:db tests/db/ingest-service.db.test.ts`.

- [ ] **Step 3: 구현** (`src/ingest/service.ts`)

```ts
import { rateFor } from "@/fx/store";
import { toKrw } from "@/fx/rates";
import type { Payment } from "@/parsers";
// ...
export async function ingestMessage(db, owner, input, fetchFn: typeof fetch = fetch): Promise<IngestResult> {
  const { parserId, result } = parseSms(input.body, input.receivedAt);
  let payment: (Payment & { amount: number }) | null = null;
  let fx: { rate: number; estimated: boolean } | null = null;
  if (result.kind === "approval" || result.kind === "cancel") {
    if (result.amount !== null) {
      payment = { ...result, amount: result.amount };
    } else if (result.foreign) {
      const rate = await rateFor(db, result.foreign.currency, result.occurredAt, fetchFn);
      if (rate) {
        payment = { ...result, amount: toKrw(result.foreign.foreignAmount, rate.krwPer) };
        fx = { rate: rate.krwPer, estimated: true };
      }
    }
  }
  const status = payment ? "parsed" : result.kind === "ignore" ? "ignored" : "unparsed";
  const { data, error } = await db.rpc("ingest_sms", {
    // ...지금 인자 그대로...
    p_currency: payment?.foreign?.currency ?? null,
    p_foreign_amount: payment?.foreign?.foreignAmount ?? null,
    p_fx_rate: fx?.rate ?? null,
    p_amount_estimated: fx?.estimated ?? false,
  });
  // 나머지 그대로
}
```

`src/parsers/index.ts`에서 `Payment` 타입도 다시 내보낸다(`export type { CardSmsParser, ParseResult, Payment } from "./types";`). Task 2에서 넣은 임시 조건(`result.amount !== null`)은 이 코드로 바뀐다.

- [ ] **Step 4: 통과 확인** — `pnpm test:db` 전체, `pnpm test`, `pnpm exec tsc --noEmit`.

- [ ] **Step 5: 커밋** — `git commit -m "feat: 해외 결제 문자를 환율로 계산해 자동 기록"`

---

### Task 6: 매일 09:10 환율 받기 (instrumentation)

**Files:**
- Create: `src/fx/schedule.ts`, `src/fx/schedule.test.ts`, `src/instrumentation.ts`
- Modify: `playwright.config.ts`(webServer env), `vitest.config.ts`(필요 시)

**Interfaces:**
- Produces: `msUntilNextRun(now: Date): number` (다음 09:10 KST까지 ms, 지금이 정확히 09:10이면 24시간 뒤), `startFxSchedule(): void`

- [ ] **Step 1: 테스트**

```ts
// src/fx/schedule.test.ts
import { describe, expect, it } from "vitest";
import { msUntilNextRun } from "./schedule";

describe("다음 환율 받기 시각", () => {
  it("09:10 KST 전이면 그날 09:10", () => {
    expect(msUntilNextRun(new Date("2026-10-10T08:00:00+09:00"))).toBe(70 * 60_000);
  });
  it("지났으면 다음 날 09:10", () => {
    expect(msUntilNextRun(new Date("2026-10-10T09:10:00+09:00"))).toBe(24 * 3600_000);
    expect(msUntilNextRun(new Date("2026-10-10T23:00:00+09:00"))).toBe(10 * 3600_000 + 10 * 60_000);
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm vitest run src/fx/schedule.test.ts`.

- [ ] **Step 3: 구현**

```ts
// src/fx/schedule.ts
const DAY = 24 * 3600_000;
const KST = 9 * 3600_000;
const RUN_AT = (9 * 60 + 10) * 60_000; // 09:10

export function msUntilNextRun(now: Date): number {
  const sinceMidnight = (now.getTime() + KST) % DAY;
  const wait = (RUN_AT - sinceMidnight + DAY) % DAY;
  return wait === 0 ? DAY : wait;
}

/** 앱이 켜질 때 한 번, 그 뒤 매일 09:10 KST. 실패는 기록만 하고 다음 날 다시 받는다 */
export function startFxSchedule(): void {
  const run = async () => {
    const { createAdminClient } = await import("@/lib/supabase-admin");
    const { fetchAndStoreRates } = await import("./store");
    const ok = await fetchAndStoreRates(createAdminClient()).catch(() => false);
    if (!ok) console.warn("[fx] 환율 받기 실패");
  };
  const loop = () => setTimeout(() => { void run().finally(loop); }, msUntilNextRun(new Date()));
  void run();
  loop();
}
```

```ts
// src/instrumentation.ts
/** 서버가 켜질 때 한 번 불린다(Next.js). Node 서버에서만 환율 타이머를 건다. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.FX_SCHEDULE === "off") return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { startFxSchedule } = await import("./fx/schedule");
  startFxSchedule();
}
```

`playwright.config.ts`의 `webServer.env`에 `FX_SCHEDULE: "off"`를 더한다(화면 테스트가 실제 API를 부르지 않게). `startFxSchedule`은 `server-only`를 직접 import하지 않으므로(동적 import) 단위 테스트에서 문제 없다.

- [ ] **Step 4: 확인** — `pnpm vitest run src/fx`, `pnpm build`(instrumentation이 빌드에 들어가는지), 로컬 `pnpm dev`를 켜고 로그에 오류가 없는지, 로컬 DB `fx_rates`에 오늘 줄이 생겼는지(`select date from fx_rates`).

- [ ] **Step 5: 커밋** — `git commit -m "feat: 앱이 켜질 때와 매일 09:10에 환율 받기"`

---

### Task 7: 확인할 문자·붙여넣기 미리 채우기

**Files:**
- Modify: `src/ledger/sms-guess.ts`, `src/ledger/sms-guess.test.ts`, `src/ledger/paste-sms.ts`, `src/ledger/paste-sms.test.ts`, `src/app/page.tsx`, `src/components/ledger/home-types.ts`, `src/components/ledger/paste-step.tsx`, `src/app/tx-actions.ts`, `src/components/ledger/add-flow.tsx`

**Interfaces:**
- Consumes: `readMoney`, `Foreign`(Task 1), `rateFor`, `toKrw`(Task 4)
- Produces:
  - `SmsGuess = { amount?: number; foreign?: Foreign; merchant?: string; occurredAt?: Date }`
  - `PasteRead` 성공 변형에 `foreign?: Foreign`, `amount`는 외화만 있을 때 `undefined`
  - 서버 액션 `convertForeign(currency: string, foreignAmount: number, occurredAtIso: string): Promise<{ amount: number; note: string } | null>`
  - `fxNote(f: Foreign, krwPer: number, date: string): string` → `"8 USD × 1,342.28원 (10월 2일 환율)로 계산했어요"` (금액 표기는 `fxLabel`) (`src/fx/rates.ts`에 둔다)
  - `RawView.guess.fxNote?: string`, `PasteFill.note?: string`

- [ ] **Step 1: 테스트**

```ts
// src/ledger/sms-guess.test.ts 에 추가
it("외화 문자는 금액 대신 외화를 돌려준다", () => {
  const g = guessFromSms("[Web발신]\n신한카드 해외승인\n$12.00\n10/04 21:15\n테스트샵", new Date("2026-10-05T00:00:00+09:00"));
  expect(g).toMatchObject({ foreign: { currency: "USD", foreignAmount: 12 }, merchant: "테스트샵" });
  expect(g.amount).toBeUndefined();
});

// src/ledger/paste-sms.test.ts 에 추가
it("외화 문자는 외화로 읽는다", () => {
  const r = readPastedSms(FOREIGN_APPROVAL, new Date("2026-10-05T12:00:00+09:00"));
  expect(r).toMatchObject({ ok: true, foreign: { currency: "USD", foreignAmount: 8 }, merchant: "typesafe a" });
});

// src/fx/rates.test.ts 에 추가
it("계산 안내 문구", () => {
  expect(fxNote({ currency: "USD", foreignAmount: 8 }, 1342.2819, "2026-10-02")).toBe("8 USD × 1,342.28원 (10월 2일 환율)로 계산했어요");
});
```

- [ ] **Step 2: 실패 확인** — `pnpm vitest run src/ledger src/fx`.

- [ ] **Step 3: 구현**
  - `sms-guess.ts`: 금액 찾기 반복문을 `readMoney(body)`로 바꾼다. `kind === "krw"` → `guess.amount`, `kind === "foreign"` → `guess.foreign`. 가게·시각 찾기는 그대로(가게 후보 줄이 `readMoney`로 금액이면 건너뛰도록 `AMOUNT.test(next)`를 `readMoney(next)`로 바꾼다).
  - `paste-sms.ts`: 분석기 결과가 `approval`이면 `{ ok: true, amount: result.amount ?? undefined, foreign: result.amount === null ? result.foreign : undefined, merchant, occurredAt }`. 짐작 경로는 `if (!g.amount && !g.foreign) return no_amount`, 결과에 `foreign` 포함. 타입: `{ ok: true; amount?: number; foreign?: Foreign; merchant?: string; occurredAt?: Date }`.
  - `src/fx/rates.ts`:

```ts
export function fxNote(f: { currency: string; foreignAmount: number }, krwPer: number, date: string): string {
  const [, m, d] = date.split("-").map(Number);
  const rate = krwPer.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  return `${fxLabel(f)} × ${rate}원 (${m}월 ${d}일 환율)로 계산했어요`;
}
```

  - `tx-actions.ts`:

```ts
export async function convertForeign(currency: string, foreignAmount: number, occurredAtIso: string) {
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) || !(foreignAmount > 0)) return null;
  const at = new Date(occurredAtIso);
  if (Number.isNaN(at.getTime())) return null;
  const db = await createSupabaseServerClient();
  const rate = await rateFor(db, currency, at, async () => new Response("{}", { status: 503 }));
  return rate ? { amount: toKrw(foreignAmount, rate.krwPer), note: fxNote({ currency, foreignAmount }, rate.krwPer, rate.date) } : null;
}
```

  (로그인 사용자 클라이언트는 `fx_rates`에 쓸 수 없으므로 받기를 시도하지 않는 가짜 fetch를 넘긴다.)
  - `paste-step.tsx` `read()`: `r.foreign`이면 `await convertForeign(r.foreign.currency, r.foreign.foreignAmount, (r.occurredAt ?? now).toISOString())`; null이면 `setError("환율을 아직 받지 못했어요. 금액을 직접 적어 주세요.")`, `return false`; 성공하면 `onRead({ amount: c.amount, note: c.note, ... })`. `PasteFill`에 `note?: string`.
  - `page.tsx` raws: `g.foreign`이면 `rateFor(supabase, ...)`(위와 같은 가짜 fetch)로 계산해 `guess.amount`·`guess.fxNote`를 채운다. `RawView.guess`에 `fxNote?: string`.
  - `add-flow.tsx`: 미리 채운 금액이 환율 계산값이면(`raw?.guess.fxNote` 또는 붙여넣기 `fill.note`) 마지막 확인 화면의 금액 아래에 `<p className="text-xs text-muted">{note}</p>`를 보여 준다. 정확한 위치는 마지막 화면에서 금액 답을 그리는 곳(`grep -n "amount" src/components/ledger/add-flow.tsx`)의 바로 아래.

- [ ] **Step 4: 확인** — `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`.

- [ ] **Step 5: 커밋** — `git commit -m "feat: 확인할 문자·붙여넣기에서 외화를 결제일 환율로 미리 채우기"`

---

### Task 8: 화면 — 목록·상세·금액 고치기·운영자 알림

**Files:**
- Modify: `src/ledger/summary.ts`(LedgerTx), `src/ledger/queries.ts`, `src/app/page.tsx`, `src/components/ledger/home-types.ts`, `src/components/ledger/tx-rows.tsx`, `src/components/ledger/tx-detail.tsx`, `src/ledger/tx-edit.ts`, `src/app/operator/page.tsx`
- Test: `tests/db/tx-edit.db.test.ts`, `e2e/foreign.spec.ts`

**Interfaces:**
- Consumes: DB 칸(Task 3), `FX_SOURCE`, `latestRateDate`(Task 4)
- Produces: `LedgerTx`·`RowTx`에 `fx?: { currency: string; foreignAmount: number; rate: number | null; estimated: boolean } | null`

- [ ] **Step 1: tx-edit DB 테스트 추가** (`tests/db/tx-edit.db.test.ts`)

```ts
it("해외 결제는 금액을 고칠 수 있고 예상 표시가 꺼진다, 국내 카드는 CARD_ONLY", async () => {
  // Task 3 테스트의 ingest 도우미와 같은 방식으로 해외 결제 1건·국내 카드 1건을 만든다
  expect(await editTx(g.owner.client, foreignId, { amount: "11,000" })).toEqual({ ok: true });
  expect(await editTx(g.owner.client, domesticId, { amount: "6,000" })).toEqual({ ok: false, error: CARD_ONLY });
});
```

- [ ] **Step 2: 구현**
  - `queries.ts` `TX_COLUMNS`에 `, currency, foreign_amount, fx_rate, amount_estimated`, `TxRow`에 같은 칸, `toLedgerTx`에 `fx: r.currency ? { currency: r.currency, foreignAmount: Number(r.foreign_amount), rate: r.fx_rate === null ? null : Number(r.fx_rate), estimated: r.amount_estimated } : null`.
  - `summary.ts` `LedgerTx`에 `fx?: ...` (위 모양), `home-types.ts` `RowTx`에도. `page.tsx` 줄 만들 때 `fx: t.fx ?? null`.
  - `tx-edit.ts` `editTx`: 금액만 바꾸는 경우 `current`를 `select("kind, currency")`로 읽고, `patch.amount !== undefined && current.kind === "approval" && current.currency`이면 `db.from("transactions").update({ amount }).eq("id", txId).select("id")`로 저장(나머지 항목은 지금처럼 manual만). 메시지 상수 그대로.
  - `src/fx/rates.ts`에 `fxLabel`을 더한다(정수면 쉼표 정수, 아니면 소수 둘째 자리):

```ts
export function fxLabel(f: { currency: string; foreignAmount: number }): string {
  const digits = Number.isInteger(f.foreignAmount) ? 0 : 2;
  return `${f.foreignAmount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${f.currency}`;
}
```

    단위 테스트: `fxLabel({ currency: "USD", foreignAmount: 8.5 })` → `"8.50 USD"`, `fxLabel({ currency: "VND", foreignAmount: 150000 })` → `"150,000 VND"`. 국민카드 `8.00(USD)`는 숫자로 8이 되어 `8 USD`로 보인다(문자의 자릿수는 저장하지 않는다). 화면 테스트의 기대 문구도 `8 USD`로 쓴다.
  - `tx-rows.tsx` 금액 칸: `{t.fx?.estimated ? "약 " : ""}{formatWon(t.amount)}원`, 그 아래 결제 수단 줄을 `t.fx ? `${t.card} · ${fxLabel(t.fx)}` : t.card`.
  - `tx-detail.tsx`: `editable = (k) => tx.kind === "manual" || k === "category" || (k === "amount" && tx.kind === "approval" && !!tx.fx)`. 큰 금액(`<p className="tabular text-[32px] ...">`) 앞에 `tx.fx?.estimated && "약 "`, 뒤에 예상이면 `<span className="text-base text-muted"> (예상)</span>`. 그 아래 `tx.fx`가 있으면 `<p className="text-sm text-muted">{fxLabel(tx.fx)}{tx.fx.rate ? \` × ${tx.fx.rate.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원\` : ""}</p>`, 상세 맨 아래(지우기 버튼·온누리 체크 근처 끝) `<p className="text-center text-[11px] text-muted">{FX_SOURCE}</p>`. 환율 날짜는 거래 날짜(결제일)로 `(${월}월 ${일}일 환율)`을 붙인다.
  - `operator/page.tsx`: `const fxDate = await latestRateDate(supabase)`; `!fxDate || 오늘(kstDateKey) - fxDate >= 2일`이면 현황 카드 아래 `<p role="status" className="card text-sm text-danger">환율 갱신 실패(마지막 {fxDate ?? "없음"})</p>`.

- [ ] **Step 3: 화면 테스트** `e2e/foreign.spec.ts` — 기존 e2e 도우미(`e2e/support.ts`)로 로그인·그룹을 만들고 service 키로 해외 결제 1건(`currency: "USD", foreign_amount: 8, fx_rate: 1342.34, amount_estimated: true, amount: 10739, kind: "approval"`)을 넣은 뒤:
  - 홈 목록에 `약 10,739원`과 `8 USD`가 보인다.
  - 줄을 눌러 상세에 `(예상)`, `× 1,342.34원`, `환율 제공: ExchangeRate-API`가 보인다.
  - 금액 항목을 눌러 `11000` 입력 → 저장 → `11,000원`, `(예상)`과 `약`이 사라진다.
  - 국내 카드 거래 상세에서는 금액 항목을 누를 수 없다(기존 테스트가 있으면 그대로 통과하는지 확인).

- [ ] **Step 4: 확인** — `pnpm test`, `pnpm test:db`, `pnpm test:e2e`, `pnpm lint`, `pnpm exec tsc --noEmit`.

- [ ] **Step 5: 커밋** — `git commit -m "feat: 해외 결제 목록·상세 표시, 금액 고치기, 환율 갱신 실패 알림"`

---

### Task 9: 문서·마무리

**Files:**
- Modify: `docs/status.md`(10절 해외 결제 줄을 "개발 완료(배포 전)"로, 새 절 추가), `docs/deploy/README.md`(배포 때 운영 DB에 `20261010000000_foreign_payment` 적용, 앱 켜질 때 환율을 받는지 기록 확인 `logs app | grep fx`)

- [ ] **Step 1:** 전체 확인 — `pnpm test && pnpm test:db && pnpm test:e2e && pnpm test:deploy && pnpm lint && pnpm exec tsc --noEmit`. 결과 숫자를 status.md에 적는다.
- [ ] **Step 2:** 별도 검토자(최상위 모델)에게 브랜치 전체 검토를 맡기고, 중요 지적을 고친다.
- [ ] **Step 3:** 커밋 `docs: 해외 결제 개발 완료(배포 전)`.
- [ ] **Step 4:** 배포는 사용자 승인 후: NAS 지금 백업 → 운영 DB `--dry-run` → 적용 → `v1.6.0` 태그 → `/api/health` 커밋 확인 → 앱 기록에 `[fx]` 실패 없음, `fx_rates`에 오늘 줄.
