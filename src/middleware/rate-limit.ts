import type { MiddlewareHandler } from 'hono';

import { getClientIP } from '../lib/validator.ts';
import type { LimitResult } from '../lib/rate-limiter.ts';
import type { Env } from '../env';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

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

/**
 * Ask the RateLimiter Durable Object to consume one request.
 *
 * Using a DO removes every KV write from the request path. We deliberately
 * fail open if the DO is unreachable: a transient DO error should not take the
 * whole site down, and the DO is evicted/restarted only rarely.
 */
async function consume(
  env: Env,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<LimitResult> {
  try {
    const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'));
    const response = await stub.fetch('https://rate-limiter/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, maxRequests, windowMs }),
    });
    if (response.ok) {
      return (await response.json()) as LimitResult;
    }
  } catch {
    // fall through to fail-open
  }
  const reset = Math.floor(Date.now() / 1000) + Math.ceil(windowMs / 1000);
  return { allowed: true, retryAfter: 0, remaining: maxRequests - 1, reset };
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
