import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Context } from 'hono';

import { rateLimitMiddleware } from '../src/middleware/rate-limit.ts';
import type { Env } from '../src/env.ts';

type MiddlewareContext = Parameters<ReturnType<typeof rateLimitMiddleware>>[0];

interface Entry {
  value: string;
  expiresAt: number;
}

/** KV with an injectable clock, so expiry is deterministic. */
class FakeKV {
  readonly store = new Map<string, Entry>();
  private readonly now: () => number;

  constructor(now: () => number) {
    this.now = now;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const ttl = options?.expirationTtl ?? Number.MAX_SAFE_INTEGER;
    this.store.set(key, { value, expiresAt: this.now() + ttl });
  }
}

function contextFor(kv: FakeKV): MiddlewareContext {
  const c = {
    env: { RATE_LIMIT_KV: kv } as unknown as Env,
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

test('a fixed window closes after its absolute expiry even under continuous traffic', async () => {
  let now = Math.floor(Date.now() / 1000);
  const kv = new FakeKV(() => now);
  const middleware = rateLimitMiddleware('trx'); // 10 requests per minute

  let passed = 0;
  const next = async () => {
    passed += 1;
  };

  for (let i = 0; i < 10; i += 1) {
    await middleware(contextFor(kv), next);
  }
  assert.equal(passed, 10, 'first ten requests must pass');

  const rejected = await middleware(contextFor(kv), next);
  assert.equal(rejected?.status, 429, 'eleventh request in the window must be rejected');
  assert.equal(passed, 10, 'rejected requests must not reach the app');

  // This is the regression: the old code refreshed the KV TTL on every put,
  // so this window never closed no matter how much time elapsed.
  now += 61;
  await middleware(contextFor(kv), next);
  assert.equal(passed, 11, 'a new window must admit traffic again');
});

test('the retry-after header reports seconds until the window resets', async () => {
  let now = Math.floor(Date.now() / 1000);
  const kv = new FakeKV(() => now);
  const middleware = rateLimitMiddleware('trx');

  for (let i = 0; i < 10; i += 1) await middleware(contextFor(kv), async () => {});
  const response = await middleware(contextFor(kv), async () => {});

  assert.equal(response?.status, 429);
  assert.equal(response?.headers.get('Retry-After'), '60');
});
