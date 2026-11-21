import type { MiddlewareHandler } from 'hono';

import { getClientIP } from '../lib/validator.ts';
import type { Env } from '../env';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

/** KV enforces a minimum expirationTtl of 60 seconds. */
const MIN_TTL_SECONDS = 60;

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  trx: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:trx' },        // 10/min for faucet claims
  freellm: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:freellm' }, // 30/min for validations
  fitness: { windowMs: 60_000, maxRequests: 20, keyPrefix: 'rl:fitness' },
  finance: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:finance' },
  blog: { windowMs: 60_000, maxRequests: 60, keyPrefix: 'rl:blog' },
  quiz: { windowMs: 60_000, maxRequests: 20, keyPrefix: 'rl:quiz' },
  games: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:games' },
  default: { windowMs: 60_000, maxRequests: 60, keyPrefix: 'rl:default' },
};

type RateLimitedEnv = { Bindings: Env };

function windowSeconds(windowMs: number): number {
  return Math.max(MIN_TTL_SECONDS, Math.ceil(windowMs / 1000));
}

interface LimitResult {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  reset: number;
}

/**
 * Fixed-window counter in KV.
 *
 * Two keys are written: the counter and the absolute expiry of the window.
 * The expiry is stored as an absolute timestamp (not a TTL) so the window
 * really ends 60 seconds after it opened even while traffic keeps arriving -
 * refreshing a TTL on every write would make the window never close.
 */
async function consume(
  env: Env,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<LimitResult> {
  const kv = env.RATE_LIMIT_KV;
  const now = Math.floor(Date.now() / 1000);
  const ttl = windowSeconds(windowMs);

  const [current, expiryRaw] = await Promise.all([kv.get(key), kv.get(`${key}:ttl`)]);

  const count = current ? parseInt(current, 10) : 0;
  const expiry = expiryRaw ? parseInt(expiryRaw, 10) : 0;
  const windowOpen = count > 0 && expiry > now;

  if (windowOpen && count >= maxRequests) {
    return { allowed: false, retryAfter: expiry - now, remaining: 0, reset: expiry };
  }

  const newCount = windowOpen ? count + 1 : 1;
  const expiresAt = windowOpen ? expiry : now + ttl;

  // expirationTtl is portable across workerd and Miniflare. The window end is
  // stored separately, so refreshing the counter's TTL cannot extend it.
  await kv.put(key, String(newCount), { expirationTtl: ttl });

  if (!windowOpen) {
    await kv.put(`${key}:ttl`, String(expiresAt), { expirationTtl: ttl });
  }

  return {
    allowed: true,
    retryAfter: 0,
    remaining: Math.max(0, maxRequests - newCount),
    reset: expiresAt,
  };
}

export function rateLimitMiddleware(appName: string): MiddlewareHandler<RateLimitedEnv> {
  const config = RATE_LIMITS[appName] ?? RATE_LIMITS.default;

  return async (c, next) => {
    const ip = getClientIP(c.req.raw);
    const key = `${config.keyPrefix}:${ip}`;
    const result = await consume(c.env, key, config.maxRequests, config.windowMs);

    if (!result.allowed) {
      return c.json(
        { error: 'Rate limit exceeded', retryAfter: result.retryAfter },
        429,
        { 'Retry-After': String(result.retryAfter) }
      );
    }

    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.reset));

    await next();
  };
}

/** Stricter limit for sensitive endpoints (claims, validations). */
export function strictRateLimitMiddleware(
  appName: string,
  maxRequests = 5,
  windowMs = 60_000
): MiddlewareHandler<RateLimitedEnv> {
  return async (c, next) => {
    const ip = getClientIP(c.req.raw);
    const key = `rl:strict:${appName}:${ip}`;
    const result = await consume(c.env, key, maxRequests, windowMs);

    if (!result.allowed) {
      return c.json(
        { error: 'Too many requests', retryAfter: result.retryAfter },
        429,
        { 'Retry-After': String(result.retryAfter) }
      );
    }

    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(result.remaining));

    await next();
  };
}
