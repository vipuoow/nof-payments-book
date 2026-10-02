import { describe, expect, it } from "vitest";
import { budgetMonth, budgetStatus, effectiveBudgets, parseBudgetInput, spentByCategory, TOTAL } from "./budget";
import type { LedgerTx } from "./summary";

const oct = { year: 2026, month: 10 };
const sep = { year: 2026, month: 9 };

describe("effectiveBudgets", () => {
  const rows = [
    { categoryId: null, month: "2026-08-01", amount: 2000000 },
    { categoryId: null, month: "2026-10-01", amount: 3000000 },
    { categoryId: "cafe", month: "2026-09-01", amount: 100000 },
    { categoryId: "food", month: "2026-09-01", amount: 500000 },
    { categoryId: "food", month: "2026-10-01", amount: 0 },
    { categoryId: "shop", month: "2026-11-01", amount: 50000 },
  ];

  it("그 달 이전 가장 최근 값을 쓰고, 0(끔)과 미래 행은 뺀다", () => {
    expect(effectiveBudgets(rows, oct)).toEqual(new Map([[TOTAL, 3000000], ["cafe", 100000]]));
  });

  it("지난달은 그때 적용되던 예산", () => {
    expect(effectiveBudgets(rows, sep)).toEqual(new Map([[TOTAL, 2000000], ["cafe", 100000], ["food", 500000]]));
  });

  it("budgetMonth", () => {
    expect(budgetMonth(oct)).toBe("2026-10-01");
    expect(budgetMonth({ year: 2027, month: 1 })).toBe("2027-01-01");
  });
});

describe("budgetStatus", () => {
  it("80% 미만 ok, 80~100% warn, 100% 초과 over", () => {
    expect(budgetStatus(79000, 100000, 0.8)).toEqual({ ratio: 0.79, remaining: 21000, level: "ok" });
    expect(budgetStatus(80000, 100000, 0.8)).toMatchObject({ level: "warn" });
    expect(budgetStatus(100000, 100000, 0.8)).toMatchObject({ level: "warn", remaining: 0 });
    expect(budgetStatus(123000, 100000, 0.8)).toMatchObject({ level: "over", remaining: -23000 });
  });
});

describe("spentByCategory", () => {
  it("카테고리별 합계(취소 반영, 미지정 제외)", () => {
    const t = (categoryId: string | null, amount: number) => ({ categoryId, amount }) as LedgerTx;
    expect(spentByCategory([t("cafe", 12300), t("cafe", -12300), t("cafe", 5000), t(null, 900), t("food", 8000)]))
      .toEqual(new Map([["cafe", 5000], ["food", 8000]]));
  });
});

describe("parseBudgetInput", () => {
  it("빈칸은 없음, 쉼표·원·공백 정리, 음수·문자·1조 이상은 오류", () => {
    expect(parseBudgetInput("")).toEqual({ ok: true, amount: null });
    expect(parseBudgetInput("  ")).toEqual({ ok: true, amount: null });
    expect(parseBudgetInput("3,000,000원")).toEqual({ ok: true, amount: 3000000 });
    expect(parseBudgetInput("0")).toEqual({ ok: true, amount: 0 });
    for (const bad of ["-1", "abc", "1.5", "1000000000000"]) {
      expect(parseBudgetInput(bad)).toEqual({ ok: false, error: "0 이상 숫자로 입력해 주세요." });
    }
  });
});
