/**
 * Per-user, in-memory rate limit. Sized for single-instance deployments
 * (Vercel default fluid compute). On a horizontally-scaled deployment this
 * becomes per-instance, not per-user — replace with Upstash Redis at that
 * point. For v1 demo, in-memory is correct.
 *
 * Two caps:
 *   - inline (10/min)  — for fast classifier calls (severity, finding triage)
 *   - heavy (3/min)    — for Sonnet-tier deep analyses (Investigator, CAPA draft)
 */

type Bucket = "inline" | "heavy";

interface Window {
  startMs: number;
  count: number;
}

const LIMITS: Record<Bucket, number> = { inline: 10, heavy: 3 };
const WINDOW_MS = 60_000;

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkRateLimit(userId: string, bucket: Bucket): RateLimitResult {
  const key = `${userId}:${bucket}`;
  const now = Date.now();
  const window = buckets.get(key);
  const limit = LIMITS[bucket];

  if (!window || now - window.startMs >= WINDOW_MS) {
    buckets.set(key, { startMs: now, count: 1 });
    return { allowed: true, remaining: limit - 1, resetMs: WINDOW_MS };
  }

  if (window.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: WINDOW_MS - (now - window.startMs),
    };
  }

  window.count += 1;
  return {
    allowed: true,
    remaining: limit - window.count,
    resetMs: WINDOW_MS - (now - window.startMs),
  };
}
