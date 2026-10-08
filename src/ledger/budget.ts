import { koWon } from "./won";
import { monthParam, type Month } from "./month";
import type { LedgerTx } from "./summary";

/** 가족 전체 예산의 키(카테고리 id 자리) */
export const TOTAL = "total";

export type BudgetRow = { categoryId: string | null; month: string; amount: number };
export type BudgetLevel = "ok" | "warn" | "over";

/** 예산 행의 달(그 달 1일) */
export function budgetMonth(m: Month): string {
  return `${monthParam(m)}-01`;
}

/** 그 달에 적용되는 예산: 카테고리마다 그 달 이전 가장 최근 행. 0은 "이 달부터 없음"이라 뺀다. */
export function effectiveBudgets(rows: BudgetRow[], m: Month): Map<string, number> {
  const target = budgetMonth(m);
  const latest = new Map<string, BudgetRow>();
  for (const row of rows) {
    if (row.month > target) continue;
    const key = row.categoryId ?? TOTAL;
    const current = latest.get(key);
    if (!current || row.month > current.month) latest.set(key, row);
  }
  return new Map([...latest].filter(([, r]) => r.amount > 0).map(([key, r]) => [key, r.amount]));
}

/** 사용률과 경고 단계. 정확히 100%는 초과가 아니다. */
export function budgetStatus(spent: number, budget: number, warnRatio: number) {
  const ratio = spent / budget;
  const level: BudgetLevel = ratio > 1 ? "over" : ratio >= warnRatio ? "warn" : "ok";
  return { ratio, remaining: budget - spent, level };
}

/** 카테고리별 사용액(취소는 음수라 그대로 더한다). 미지정은 뺀다. */
export function spentByCategory(txs: LedgerTx[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const tx of txs) {
    if (tx.categoryId) sums.set(tx.categoryId, (sums.get(tx.categoryId) ?? 0) + tx.amount);
  }
  return sums;
}

/** 예산 입력칸: 빈칸은 없음(null). 쉼표·"원"·공백은 지우고 0 이상 1조 미만 정수만 받는다. */
export function parseBudgetInput(text: string): { ok: true; amount: number | null } | { ok: false; error: string } {
  const cleaned = text.replace(/[,\s원]/g, "");
  if (cleaned === "") return { ok: true, amount: null };
  if (!/^\d+$/.test(cleaned) || Number(cleaned) >= 1e12) return { ok: false, error: "0 이상 숫자로 입력해 주세요." };
  return { ok: true, amount: Number(cleaned) };
}

export type LimitLevel = "ok" | "caution" | "bad";

/**
 * 홈 한도 카드(설계 2026-10-08 B안). 사용률 50% 이하 녹색 · 85% 미만 노랑 · 85% 이상 빨강.
 * 막대 안 글자: 남은 돈이 한도의 10% 이상이면 한글 단위 금액, 밑이면 문구.
 * tight: 70% 넘게 써서 남은 칸이 좁으면 글자를 색 막대 끝 안쪽으로 옮긴다.
 */
export function limitView(spent: number, limit: number) {
  const ratio = limit > 0 ? spent / limit : 1;
  const level: LimitLevel = ratio <= 0.5 ? "ok" : ratio < 0.85 ? "caution" : "bad";
  const rest = limit - spent;
  const label = rest >= limit * 0.1 ? `${koWon(rest)}원 남음`
    : rest > 0 ? "거의 다 썼어요"
      : rest === 0 ? "다 썼어요"
        : ratio < 1.3 ? "우리 다음 달을 생각해요" : "슬픈 결제일이 될 것 같아요";
  return { level, label, fill: Math.min(1, Math.max(0, ratio)), tight: ratio > 0.7 };
}
