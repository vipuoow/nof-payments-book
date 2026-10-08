import { describe, expect, it } from "vitest";
import { isUuid, parseTxForm } from "./forms";

const form = (over: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    amount: "12,300", merchant: " 시장 ", occurredAt: "2026-10-02T08:26", userId: "u1", categoryId: "", memo: " 점심 ",
    ...over,
  };
  return (name: string) => values[name] ?? "";
};

describe("parseTxForm", () => {
  it("쉼표·원·공백을 정리해 받아들인다", () => {
    expect(parseTxForm(form())).toEqual({
      ok: true,
      value: {
        amount: 12300, merchant: "시장", occurredAt: new Date("2026-10-01T23:26:00Z"),
        userId: "u1", categoryId: null, memo: "점심",
      },
    });
    expect(parseTxForm(form({ amount: "12300원" }))).toMatchObject({ ok: true, value: { amount: 12300 } });
    expect(parseTxForm(form({ amount: " 5000 " }))).toMatchObject({ ok: true, value: { amount: 5000 } });
    expect(parseTxForm(form({ categoryId: "c1" }))).toMatchObject({ ok: true, value: { categoryId: "c1" } });
  });

  it("금액이 1원 이상 정수가 아니면 막는다", () => {
    for (const amount of ["0", "-5", "1.5", "abc", "", "99999999999999999"]) {
      expect(parseTxForm(form({ amount }))).toEqual({ ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." });
    }
  });

  it("가맹점 빈칸·일시 오류·사람 없음을 막는다", () => {
    expect(parseTxForm(form({ merchant: "  " }))).toEqual({ ok: false, error: "가맹점을 입력해 주세요." });
    expect(parseTxForm(form({ merchant: "가".repeat(101) }))).toEqual({ ok: false, error: "가맹점은 100자까지 입력할 수 있습니다." });
    expect(parseTxForm(form({ occurredAt: "2026-02-30T10:00" }))).toEqual({ ok: false, error: "일시를 확인해 주세요." });
    expect(parseTxForm(form({ userId: "" }))).toEqual({ ok: false, error: "사람을 골라 주세요." });
  });

  it("메모는 200자로 자른다", () => {
    const r = parseTxForm(form({ memo: "가".repeat(250) }));
    expect(r.ok && r.value.memo.length).toBe(200);
  });
});

describe("isUuid", () => {
  it("uuid 형식만 참", () => {
    expect(isUuid("5d30839b-4971-46f7-976c-0ab9d67c1067")).toBe(true);
    expect(isUuid("5d30839b")).toBe(false);
    expect(isUuid(["5d30839b-4971-46f7-976c-0ab9d67c1067"])).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("parseTxForm 미래 날짜", () => {
  const now = new Date("2026-10-02T03:00:00Z"); // KST 10/2 12:00
  it("이번 달(KST) 안이면 받아들이고, 다음 달 이후면 막는다", () => {
    expect(parseTxForm(form({ occurredAt: "2026-10-31T23:59" }), now)).toMatchObject({ ok: true });
    expect(parseTxForm(form({ occurredAt: "2026-11-01T00:00" }), now)).toEqual({ ok: false, error: "일시를 확인해 주세요." });
    expect(parseTxForm(form({ occurredAt: "2027-10-02T08:26" }), now)).toEqual({ ok: false, error: "일시를 확인해 주세요." });
  });
});

describe("항목별 검사(상세에서 한 항목씩 고칠 때)", () => {
  it("금액·가게·언제를 따로 검사한다", async () => {
    const { parseAmount, parseMerchant, parseOccurredAt } = await import("./forms");
    expect(parseAmount("1만 3325")).toEqual({ ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." });
    expect(parseAmount("13,325원")).toEqual({ ok: true, value: 13325 });
    expect(parseMerchant("  ")).toEqual({ ok: false, error: "가맹점을 입력해 주세요." });
    expect(parseMerchant(" 시장 ")).toEqual({ ok: true, value: "시장" });
    const now = new Date("2026-10-08T05:00:00Z");
    expect(parseOccurredAt("2026-10-08T09:00", now)).toEqual({ ok: true, value: new Date("2026-10-08T00:00:00Z") });
    expect(parseOccurredAt("2026-11-01T09:00", now)).toEqual({ ok: false, error: "일시를 확인해 주세요." });
  });
});
