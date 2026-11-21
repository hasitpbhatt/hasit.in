import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Context } from 'hono';

import { rateLimitMiddleware } from '../src/middleware/rate-limit.ts';
import { FixedWindowLimiter, RateLimiter } from '../src/lib/rate-limiter.ts';
import type { Env } from '../src/env.ts';

type MiddlewareContext = Parameters<ReturnType<typeof rateLimitMiddleware>>[0];

/** Minimal fake of the RATE_LIMITER namespace, delegating to a real RateLimiter DO. */
class FakeRateLimiterNamespace {
  private readonly instance = new RateLimiter();

  idFromName(_name: string): string {
    return 'stub-id';
  }

  get(_id: string) {
    const instance = this.instance;
    return {
      fetch(url: string, init?: RequestInit): Promise<Response> {
        return instance.fetch(new Request(url, init));
      },
    };
  }
}

function contextFor(): MiddlewareContext {
  const c = {
    env: { RATE_LIMITER: new FakeRateLimiterNamespace() } as unknown as Env,
    req: {
      raw: new Request('https://trx.hasit.in/', {
        headers: { 'CF-Connecting-IP': '198.51.100.7' },
      }),
    },
    header() {},
    json(body: unknown, status: number, headers?: Record<string, string>) {
      return new Response(JSON.stringify(body), { status, headers });
    },
  };
  return c as unknown as Context<{ Bindings: Env }>;
}

// --- Pure limiter (deterministic clock) ---

test('a fixed window closes after its absolute expiry even under continuous traffic', () => {
  let now = Math.floor(Date.now() / 1000);
  const limiter = new FixedWindowLimiter(() => now);

  for (let i = 0; i < 10; i += 1) {
    assert.equal(limiter.consume('client', 10, 60).allowed, true);
  }
  const blocked = limiter.consume('client', 10, 60);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfter, 60);
  assert.equal(blocked.remaining, 0);

  // Regression: refreshing the window on each hit would never let it close.
  now += 61;
  assert.equal(limiter.consume('client', 10, 60).allowed, true);
});

test('retryAfter is the seconds remaining until the absolute reset', () => {
  let now = 1000;
  const limiter = new FixedWindowLimiter(() => now);
  for (let i = 0; i < 5; i += 1) limiter.consume('client', 5, 60);

  now += 20;
  const result = limiter.consume('client', 5, 60);
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfter, 40);
  assert.equal(result.reset, 1060);
});

test('the limiter keeps separate windows per key', () => {
  const limiter = new FixedWindowLimiter(() => 1000);
  assert.equal(limiter.consume('a', 1, 60).allowed, true);
  assert.equal(limiter.consume('a', 1, 60).allowed, false);
  assert.equal(limiter.consume('b', 1, 60).allowed, true);
});

// --- Middleware -> DO path ---

test('the middleware rejects requests over the limit and stops them reaching the app', async () => {
  const middleware = rateLimitMiddleware('trx'); // 10 requests per minute
  const ctx = contextFor();
  let passed = 0;
  const next = async () => {
    passed += 1;
  };

  for (let i = 0; i < 10; i += 1) await middleware(ctx, next);
  assert.equal(passed, 10, 'first ten requests must pass');

  const rejected = await middleware(ctx, next);
  assert.equal(rejected?.status, 429, 'eleventh request in the window must be rejected');
  assert.equal(passed, 10, 'rejected requests must not reach the app');

  const retryAfter = Number(rejected?.headers.get('Retry-After'));
  assert.ok(retryAfter >= 1 && retryAfter <= 60, `Retry-After ${retryAfter} out of range`);
});

test('the DO rejects invalid input and unsupported methods', async () => {
  const instance = new RateLimiter();
  assert.equal((await instance.fetch(new Request('https://x/', { method: 'GET' }))).status, 405);
  assert.equal(
    (
      await instance.fetch(
        new Request('https://x/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: '', maxRequests: 5, windowMs: 60_000 }),
        })
      )
    ).status,
    400
  );
});
