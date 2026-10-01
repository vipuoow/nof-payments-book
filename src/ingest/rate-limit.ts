export type RateLimiter = (key: string) => boolean;

/**
 * 키별 고정 창 요청 제한(단일 프로세스 메모리).
 * 키가 maxKeys만큼 쌓이면 만료된 창을 지우고, 그래도 가득 차 있으면 새 키를 거부해 메모리를 묶어 둔다.
 */
export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}): RateLimiter {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, { start: number; count: number }>();

  return (key) => {
    const t = now();
    const w = windows.get(key);
    if (w && t - w.start < opts.windowMs) {
      if (w.count >= opts.limit) return false;
      w.count += 1;
      return true;
    }

    if (!w && windows.size >= maxKeys) {
      for (const [k, v] of windows) {
        if (t - v.start >= opts.windowMs) windows.delete(k);
      }
      if (windows.size >= maxKeys) return false;
    }
    windows.set(key, { start: t, count: 1 });
    return true;
  };
}
