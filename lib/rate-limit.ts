import 'server-only';

/**
 * Fixed-window rate limiter for public route handlers.
 *
 * In-process and per-instance by design: it is a cheap ceiling on obvious abuse of the
 * three unauthenticated write-ish endpoints (search-adjacent polling, newsletter,
 * vitals), not a distributed quota. Behind more than one instance the effective limit is
 * N times the configured one, which is stated in the runbook rather than pretended away;
 * the real ceiling belongs at the edge/WAF.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, max: number, now = Date.now()): RateLimitResult {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, remaining: max - 1, resetAt: bucket.resetAt };
  }
  existing.count += 1;
  return { ok: existing.count <= max, remaining: Math.max(0, max - existing.count), resetAt: existing.resetAt };
}

/**
 * Client address for bucketing.
 *
 * `x-forwarded-for` is client-writable, so it is only trusted when the deployment says a
 * proxy is in front (`TRUST_PROXY`). Otherwise every request shares one bucket, which is
 * the safe failure: it throttles too much rather than letting a spoofed header mint a
 * private quota per request.
 */
export function clientKey(headers: Headers, fallback = 'anonymous'): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = headers.get('x-forwarded-for');
    const first = forwarded?.split(',')[0]?.trim();
    if (first) return first;
    const real = headers.get('x-real-ip');
    if (real) return real.trim();
  }
  return fallback;
}

/** Test seam. */
export function resetRateLimits(): void {
  buckets.clear();
}
