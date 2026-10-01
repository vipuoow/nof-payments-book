import { randomToken, sha256Hex } from "@/lib/hash";

/** 한 번만 보여 줄 비밀값과 DB에 저장할 해시 */
export function newSecret(): { token: string; hash: string } {
  const token = randomToken();
  return { token, hash: sha256Hex(token) };
}
