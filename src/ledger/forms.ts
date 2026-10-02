import { compareMonth, kstMonthOf, parseKstLocal } from "./month";

export type TxInput = {
  amount: number;
  merchant: string;
  occurredAt: Date;
  userId: string;
  categoryId: string | null;
  memo: string;
};

export type TxFormResult = { ok: true; value: TxInput } | { ok: false; error: string };

/** 수동 입력·거래 수정 폼 검증. 금액은 쉼표·"원"·공백을 지우고 1원 이상 정수만 받는다. 일시는 이번 달(KST)까지. */
export function parseTxForm(get: (name: string) => string, now: Date = new Date()): TxFormResult {
  const amountText = get("amount").replace(/[,\s원]/g, "");
  const amount = Number(amountText);
  if (!/^\d+$/.test(amountText) || amount < 1 || !Number.isSafeInteger(amount)) {
    return { ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." };
  }
  const merchant = get("merchant").trim();
  if (!merchant) return { ok: false, error: "가맹점을 입력해 주세요." };
  if (merchant.length > 100) return { ok: false, error: "가맹점은 100자까지 입력할 수 있습니다." };
  const occurredAt = parseKstLocal(get("occurredAt"));
  // 다음 달 이후로 저장하면 홈에서 그 달로 갈 수 없어 거래가 보이지 않는다
  if (!occurredAt || compareMonth(kstMonthOf(occurredAt), kstMonthOf(now)) > 0) {
    return { ok: false, error: "일시를 확인해 주세요." };
  }
  const userId = get("userId");
  if (!userId) return { ok: false, error: "사람을 골라 주세요." };
  return {
    ok: true,
    value: {
      amount,
      merchant,
      occurredAt,
      userId,
      categoryId: get("categoryId") || null,
      memo: get("memo").trim().slice(0, 200),
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
