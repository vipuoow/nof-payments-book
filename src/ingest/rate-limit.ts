export type RateLimiter = (key: string) => boolean;

/** 키별 고정 창 요청 제한(단일 프로세스 메모리). */
export function createRateLimiter(opts: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const now = opts.now ?? Date.now;
  const windows = new Map<string, { start: number; count: number }>();

  return (key) => {
    const t = now();
    const w = windows.get(key);
    if (!w || t - w.start >= opts.windowMs) {
      windows.set(key, { start: t, count: 1 });
      return true;
    }
    if (w.count >= opts.limit) return false;
    w.count += 1;
    return true;
  };
}
