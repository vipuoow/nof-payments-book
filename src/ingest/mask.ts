/** 저장 전에 원문의 카드번호 일부를 가린다. 분석은 마스킹 전 원문으로 한다. */
export function maskBody(body: string): string {
  return body.replace(/(카드)\d{4}/g, "$1****");
}
