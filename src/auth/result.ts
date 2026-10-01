import { rpcErrorCode } from "./messages";

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

/** RPC를 호출해 알려진 오류 코드는 Result로, 그 밖의 오류는 예외로 돌려준다. */
export async function callRpc<T>(
  p: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  map: (data: unknown) => T,
): Promise<Result<T>> {
  const { data, error } = await p;
  if (error) {
    const code = rpcErrorCode(error);
    if (code) return { ok: false, reason: code };
    throw error;
  }
  return { ok: true, value: map(data) };
}
