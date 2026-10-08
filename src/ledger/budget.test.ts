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

describe("limitView (홈 한도 카드)", () => {
  it("사용률에 따라 녹색·노랑·빨강", async () => {
    const { limitView } = await import("./budget");
    expect(limitView(1_000_000, 2_000_000).level).toBe("ok"); // 50%
    expect(limitView(1_000_001, 2_000_000).level).toBe("caution");
    expect(limitView(1_699_999, 2_000_000).level).toBe("caution");
    expect(limitView(1_700_000, 2_000_000).level).toBe("bad"); // 85%
  });

  it("남은 돈이 10% 이상이면 한글 단위 금액, 밑이면 문구", async () => {
    const { limitView } = await import("./budget");
    expect(limitView(1_280_000, 2_000_000).label).toBe("72만원 남음");
    expect(limitView(1_912_300, 2_000_000).label).toBe("거의 다 썼어요");
    expect(limitView(2_000_000, 2_000_000).label).toBe("다 썼어요");
    expect(limitView(2_100_000, 2_000_000).label).toBe("우리 다음 달을 생각해요");
    expect(limitView(2_600_000, 2_000_000).label).toBe("슬픈 결제일이 될 것 같아요"); // 130%
    expect(limitView(12_300, 100_000).label).toBe("8만 7700원 남음");
  });

  it("막대 채움은 0~1, 70%를 넘으면 글자를 막대 안쪽으로(tight)", async () => {
    const { limitView } = await import("./budget");
    expect(limitView(-5000, 100_000)).toMatchObject({ fill: 0, tight: false });
    expect(limitView(70_000, 100_000)).toMatchObject({ fill: 0.7, tight: false });
    expect(limitView(70_001, 100_000).tight).toBe(true);
    expect(limitView(300_000, 100_000).fill).toBe(1);
  });
});
