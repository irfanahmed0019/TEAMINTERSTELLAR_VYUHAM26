/**
 * Small in-memory sliding-window limiter. Serverless instances do not share
 * memory, so this is best effort: it stops a single instance being hammered
 * but is not a global quota.
 */
export function createRateLimiter(maxKeys = 5000) {
  const hits = new Map<string, number[]>();
  return function limited(key: string, max: number, windowMs = 60_000, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return true;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > maxKeys) for (const k of hits.keys()) { hits.delete(k); break; }
    return false;
  };
}
