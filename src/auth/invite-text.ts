/** 화면에 보이는 만료일 "M월 D일"(KST) */
export function kstMonthDay(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}

/** 파트너 초대 링크를 카카오톡·문자로 보낼 때의 문구 */
export function inviteShareText(inviter: string, expiresAt: string, url: string): string {
  return `${inviter}님이 같이가계부에 초대했어요. 아래 링크로 가입해 주세요(${kstMonthDay(expiresAt)}까지).\n${url}`;
}
