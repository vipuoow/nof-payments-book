/** 금액을 한글 단위로: 13325 → "1만 3325", 123456789 → "1억 2345만 6789". 0인 단위는 뺀다. */
export function koWon(value: number | string): string {
  const n = Math.floor(Number(value) || 0);
  if (n <= 0) return "";
  const eok = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const rest = n % 1e4;
  const out: string[] = [];
  if (eok) out.push(`${eok}억`);
  if (man) out.push(`${man}만`);
  if (rest) out.push(String(rest));
  return out.join(" ");
}

export const MAX_AMOUNT_DIGITS = 11;

/**
 * 금액 칸의 실제 숫자. 화면에는 한글 단위가 보이므로 화면 글자에서 숫자를 뽑으면
 * "10만" 뒤에 5를 눌렀을 때 105가 된다. 입력 한 번(beforeinput)마다 실제 숫자를 따로 계산한다.
 * 처리하지 않는 입력이면 null.
 */
export function nextRawAmount(raw: string, inputType: string, data: string | null): string | null {
  let next: string;
  if (inputType === "deleteContentBackward" || inputType === "deleteContentForward" || inputType === "deleteWordBackward") {
    next = raw.slice(0, -1);
  } else if (inputType === "deleteByCut" || inputType === "deleteContent" || inputType === "deleteSoftLineBackward") {
    next = "";
  } else if (inputType.startsWith("insert") && data != null) {
    next = raw + data.replace(/[^0-9]/g, "");
  } else {
    return null;
  }
  return next.replace(/^0+/, "").slice(0, MAX_AMOUNT_DIGITS);
}
