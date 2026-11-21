/**
 * Durable Object-based rate limiting.
 *
 * The old implementation kept fixed-window counters in KV and called `kv.put()`
 * on every request (twice when a window opened). KV's free tier allows only
 * 1,000 writes/day, so real traffic + bots exhausted it in no time.
 *
 * A Durable Object keeps the counters in memory instead: no KV writes at all,
 * and DO requests are covered by the Workers request allowance. The trade-off
 * is that counters reset if the DO restarts (e.g. during a deploy) - perfectly
 * acceptable for rate limiting, where a slightly early window reset only
 * permits a handful of extra requests.
 */

/** Result of a single rate-limit check. All time values are in seconds. */
export interface LimitResult {
  allowed: boolean;
  /** Seconds until the current window resets (0 when allowed). */
  retryAfter: number;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Absolute epoch seconds at which the window resets. */
  reset: number;
}

/** Payload sent from the Worker to the RateLimiter DO. */
export interface ConsumeInput {
  key: string;
  maxRequests: number;
  /** Window length in milliseconds; converted to seconds by the DO. */
  windowMs: number;
}

interface Window {
  count: number;
  reset: number;
}

/**
 * Pure in-memory fixed-window limiter.
 *
 * Kept separate from the DO wrapper so it can unit-tested with a deterministic
 * clock. The window closes at an absolute timestamp (`reset`) and is never
 * extended by incoming traffic - refreshing a TTL on each hit would make the
 * window never close under sustained load.
 */
export class FixedWindowLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly nowSec: () => number;

  constructor(nowSec: () => number = () => Math.floor(Date.now() / 1000)) {
    this.nowSec = nowSec;
  }

  consume(key: string, maxRequests: number, windowSec: number): LimitResult {
    const now = this.nowSec();
    const existing = this.windows.get(key);
    const open = existing && existing.reset > now ? existing : null;

    // Drop an expired window so a new one starts cleanly.
    if (existing && existing.reset <= now) this.windows.delete(key);

    if (open) {
      if (open.count >= maxRequests) {
        return {
          allowed: false,
          retryAfter: Math.max(1, open.reset - now),
          remaining: 0,
          reset: open.reset,
        };
      }
      open.count += 1;
      return {
        allowed: true,
        retryAfter: 0,
        remaining: Math.max(0, maxRequests - open.count),
        reset: open.reset,
      };
    }

    const reset = now + windowSec;
    this.windows.set(key, { count: 1, reset });
    return {
      allowed: true,
      retryAfter: 0,
      remaining: Math.max(0, maxRequests - 1),
      reset,
    };
  }
}

/**
 * Durable Object that owns the in-memory counters for every rate-limit key.
 *
 * A single instance handles all keys (the `key` in the payload distinguishes
 * app + client IP). This site's traffic is easily served by one DO; if it ever
 * needs sharding, calling `idFromName(key)` instead of a fixed name spreads the
 * load across many instances with no other changes.
 */
export class RateLimiter {
  private readonly limiter = new FixedWindowLimiter();

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { Allow: 'POST' } }
      );
    }

    let input: ConsumeInput;
    try {
      input = (await request.json()) as ConsumeInput;
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { key, maxRequests, windowMs } = input;
    if (
      typeof key !== 'string' ||
      key.length === 0 ||
      !Number.isFinite(maxRequests) ||
      maxRequests <= 0 ||
      !Number.isFinite(windowMs) ||
      windowMs <= 0
    ) {
      return Response.json({ error: 'Invalid rate-limit input' }, { status: 400 });
    }

    const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
    return Response.json(this.limiter.consume(key, maxRequests, windowSec));
  }
}
