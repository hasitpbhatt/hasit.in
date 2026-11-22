import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coingecko } from '../src/lib/coingecko.ts';
import type { Env } from '../src/env.ts';

test('price requests use edge cache, never KV, and serve stale data on upstream failure', async () => {
  const entries = new Map<string, Response>();
  let cacheReads = 0;
  let cacheWrites = 0;
  let upstreamCalls = 0;
  let kvCalls = 0;
  let now = Date.now();

  const originalCaches = globalThis.caches;
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  const originalLog = console.error;
  const originalWarn = console.warn;
  const cache = {
    async match(request: RequestInfo | URL) {
      cacheReads += 1;
      const key = request instanceof Request ? request.url : String(request);
      return entries.get(key)?.clone();
    },
    async put(request: RequestInfo | URL, response: Response) {
      cacheWrites += 1;
      const key = request instanceof Request ? request.url : String(request);
      entries.set(key, response.clone());
    },
  };

  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { default: cache } as unknown as CacheStorage,
  });
  Date.now = () => now;
  console.error = () => {};
  console.warn = () => {};
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    if (upstreamCalls > 1) return new Response('unavailable', { status: 503 });
    return Response.json({ tron: { usd: 0.1, btc: 0.000001, usd_24h_change: 2 } });
  };

  const env = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'KV') {
          kvCalls += 1;
          throw new Error('KV must not be accessed by request handlers');
        }
        return undefined;
      },
    }
  ) as Env;

  try {
    const first = await coingecko.getPrice(env, 'TRX');
    assert.equal(first?.usd, 0.1);
    assert.deepEqual(await coingecko.getPrice(env, 'TRX'), first);
    assert.equal(upstreamCalls, 1, 'a cache hit must not fetch CoinGecko again');
    assert.equal(cacheWrites, 1);
    assert.equal(kvCalls, 0);

    now += 901_000;
    assert.deepEqual(await coingecko.getPrice(env, 'TRX'), first);
    assert.equal(upstreamCalls, 2, 'stale cache data should trigger a refresh attempt');
    assert.equal(kvCalls, 0);
    assert.ok(cacheReads >= 3);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    console.error = originalLog;
    console.warn = originalWarn;
    if (originalCaches === undefined) {
      Reflect.deleteProperty(globalThis, 'caches');
    } else {
      Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: originalCaches,
      });
    }
  }
});

test('unknown symbols do not call the upstream price service', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({});
  };

  try {
    assert.equal(await coingecko.getPrice({} as Env, 'UNKNOWN'), null);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
