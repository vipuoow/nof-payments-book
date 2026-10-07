const ISSUERS: Record<string, string> = { kb: "국민카드", hyundai: "현대카드" };

/** 거래 줄 금액 아래에 보이는 쓴 카드. 직접 입력한 거래는 "직접 입력". */
export function issuerLabel(issuer: string | null, kind: string): string {
  if (kind === "manual") return "직접 입력";
  return (issuer && ISSUERS[issuer]) || "카드";
}
