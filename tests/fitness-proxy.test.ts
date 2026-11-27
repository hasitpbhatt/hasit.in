import { test } from 'node:test';
import assert from 'node:assert/strict';

import { proxyFitness } from '../src/lib/fitness-proxy.ts';
import type { Env } from '../src/env.ts';

const env = { FITNESS_ORIGIN: 'https://fitness-8lk.pages.dev' } as Env;

/** Runs proxyFitness with global fetch stubbed, returning both sides. */
async function call(request: Request) {
  const realFetch = globalThis.fetch;
  let seen: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    // proxyFitness passes a single Request; normalise so assertions can read both.
    const req = input instanceof Request ? input : new Request(String(input), init);
    seen = { url: req.url, init: { method: req.method, headers: req.headers, body: req.body, redirect: req.redirect } };
    return new Response('upstream-body', {
      status: 302,
      headers: {
        location: 'https://fitness.hasit.in/dashboard',
        'content-type': 'text/html',
        'content-encoding': 'gzip',
        'content-length': '999',
        'x-frame-options': 'DENY',
      },
    });
  }) as typeof fetch;

  try {
    const response = await proxyFitness(request, env);
    return { response, seen: seen as { url: string; init: RequestInit } | null };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test('proxy forwards method, path, query and body to the Pages origin', async () => {
  const request = new Request('https://fitness.hasit.in/api/workouts?week=3', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'fitness.hasit.in', 'x-hasit-app': 'fitness' },
    body: JSON.stringify({ done: true }),
  });

  const { seen } = await call(request);

  assert.equal(seen?.url, 'https://fitness-8lk.pages.dev/api/workouts?week=3');
  assert.equal(seen?.init.method, 'POST');
  assert.equal(seen?.init.redirect, 'manual');
  assert.ok(seen?.init.body, 'body must be forwarded for non-GET');
});

test('proxy strips hop-by-hop and Worker-internal headers', async () => {
  const request = new Request('https://fitness.hasit.in/', {
    headers: {
      host: 'fitness.hasit.in',
      'x-hasit-host': 'fitness.hasit.in',
      'x-hasit-app': 'fitness',
      'x-hasit-dev-app': 'trx',
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      'x-keep-me': 'yes',
    },
  });

  const { seen } = await call(request);
  const sent = new Headers(seen?.init.headers as HeadersInit);

  for (const name of ['host', 'x-hasit-host', 'x-hasit-app', 'x-hasit-dev-app', 'connection', 'transfer-encoding']) {
    assert.equal(sent.has(name), false, `${name} must not reach upstream`);
  }
  assert.equal(sent.get('x-keep-me'), 'yes');
});

test('proxy preserves upstream status, redirects and body framing', async () => {
  const { response } = await call(new Request('https://fitness.hasit.in/login'));

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://fitness.hasit.in/dashboard');
  assert.equal(response.headers.get('content-encoding'), 'gzip');
  assert.equal(response.headers.get('content-length'), '999');
  assert.equal(await response.text(), 'upstream-body');
});

test('proxy keeps the upstream policy and only adds missing HSTS', async () => {
  const { response } = await call(new Request('https://fitness.hasit.in/'));

  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(
    response.headers.get('strict-transport-security'),
    'max-age=31536000; includeSubDomains; preload',
  );
  assert.equal(response.headers.get('x-hasit-app'), 'fitness');
});
