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

type Field<T> = { ok: true; value: T } | { ok: false; error: string };

/** 금액: 쉼표·"원"·공백을 지우고 1원 이상 정수만 받는다. */
export function parseAmount(text: string): Field<number> {
  const amountText = text.replace(/[,\s원]/g, "");
  const amount = Number(amountText);
  if (!/^\d+$/.test(amountText) || amount < 1 || !Number.isSafeInteger(amount)) {
    return { ok: false, error: "금액은 1원 이상 숫자로 입력해 주세요." };
  }
  return { ok: true, value: amount };
}

export function parseMerchant(text: string): Field<string> {
  const merchant = text.trim();
  if (!merchant) return { ok: false, error: "가맹점을 입력해 주세요." };
  if (merchant.length > 100) return { ok: false, error: "가맹점은 100자까지 입력할 수 있습니다." };
  return { ok: true, value: merchant };
}

/** 일시(KST "YYYY-MM-DDTHH:mm")는 이번 달까지. 다음 달 이후로 저장하면 홈에서 그 달로 갈 수 없어 거래가 보이지 않는다. */
export function parseOccurredAt(text: string, now: Date = new Date()): Field<Date> {
  const occurredAt = parseKstLocal(text);
  if (!occurredAt || compareMonth(kstMonthOf(occurredAt), kstMonthOf(now)) > 0) {
    return { ok: false, error: "일시를 확인해 주세요." };
  }
  return { ok: true, value: occurredAt };
}

/** 새로 추가 검증: 항목별 검사를 차례로 한다. */
export function parseTxForm(get: (name: string) => string, now: Date = new Date()): TxFormResult {
  const amount = parseAmount(get("amount"));
  if (!amount.ok) return amount;
  const merchant = parseMerchant(get("merchant"));
  if (!merchant.ok) return merchant;
  const occurredAt = parseOccurredAt(get("occurredAt"), now);
  if (!occurredAt.ok) return occurredAt;
  const userId = get("userId");
  if (!userId) return { ok: false, error: "사람을 골라 주세요." };
  return {
    ok: true,
    value: {
      amount: amount.value,
      merchant: merchant.value,
      occurredAt: occurredAt.value,
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
