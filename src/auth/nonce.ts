import { randomToken, sha256Hex } from "@/lib/hash";

/**
 * Google ID 토큰 재사용을 막는 1회용 값. 원래 값은 서버(쿠키)에 두고 Supabase에 넘기며,
 * Google 로그인 창에는 해시한 값을 넘긴다(Supabase가 토큰 안의 nonce와 해시를 비교한다).
 */
export function newNonce(): string {
  return randomToken();
}

export function hashNonce(raw: string): string {
  return sha256Hex(raw);
}
