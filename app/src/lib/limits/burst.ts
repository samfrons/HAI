/**
 * A sliding-window per-key limiter held in process memory.
 *
 * The same caveat as the chat route's inline limiter applies and is worth
 * repeating rather than assuming: this is not a distributed rate limiter. It
 * resets on deploy, and each serverless instance keeps its own counter, so the
 * effective ceiling is the configured one times however many instances the
 * platform decided to run. It paces one impatient browser. `claimDailyRequest`
 * is what actually bounds a day.
 *
 * Extracted as a module because the deliverables route needs a *different*
 * window from chat's, for a reason worth stating: one chat message is one model
 * call, while one deliverable run is roughly sixteen, spread across two or three
 * minutes of wall clock. Twenty of those a minute is not a limit.
 */

export interface BurstLimiter {
  /** True when the key has exhausted its window; also records the attempt. */
  isLimited(key: string): boolean;
}

export function createBurstLimiter(limit: number, windowMs: number): BurstLimiter {
  const log = new Map<string, number[]>();

  return {
    isLimited(key: string): boolean {
      const now = Date.now();
      const cutoff = now - windowMs;
      const recent = (log.get(key) ?? []).filter((at) => at > cutoff);

      if (recent.length >= limit) {
        log.set(key, recent);
        return true;
      }

      recent.push(now);
      log.set(key, recent);

      // Opportunistic sweep so the map cannot grow without bound.
      if (log.size > 5_000) {
        for (const [entryKey, timestamps] of log) {
          if (timestamps.every((at) => at <= cutoff)) log.delete(entryKey);
        }
      }

      return false;
    },
  };
}

/** The caller's IP as far as the platform will tell us, or `unknown`. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
