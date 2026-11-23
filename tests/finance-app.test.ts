import { test } from 'node:test';
import assert from 'node:assert/strict';

import { financeApp } from '../src/apps/finance/index.ts';
import quizAiProxy from '../apps/quiz/quiz/proxy/worker.js';

const env = {} as Parameters<typeof financeApp.fetch>[1];

test('finance Worker exposes app health and root metadata', async () => {
  const health = await financeApp.request('/health', {}, env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok', app: 'finance' });

  const root = await financeApp.request('/', {}, env);
  assert.deepEqual(await root.json(), { name: 'Finance', status: 'ok' });
});

test('finance API routes include preflight and Worker-hosted stock page assets', async () => {
  const preflight = await financeApp.request('/api/overview', { method: 'OPTIONS' }, env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), '*');

  const stockPage = await financeApp.request('/s/AAPL', {}, env);
  assert.equal(stockPage.status, 200);
  const html = await stockPage.text();
  assert.match(html, /href="\/apps\/finance\/styles\.css"/);
  assert.match(html, /src="\/apps\/finance\/app\.js"/);

  const apiStockPage = await financeApp.request('/api/s/AAPL', {}, env);
  assert.equal(apiStockPage.status, 200);

  const invalidSymbol = await financeApp.request('/s/TOOLONG', {}, env);
  assert.equal(invalidSymbol.status, 404);
});

test('quiz AI proxy validates origin and request payload without contacting FreeLLM', async () => {
  const testEnv = {
    FREELLM_API_KEY: 'test-key',
  } as Parameters<typeof quizAiProxy.fetch>[1];

  const authHeaders = {
    'X-Freellm-Api-Key': 'test-freellm-key',
    'Content-Type': 'application/json',
  };

  // Test forbidden origin
  const forbidden = await quizAiProxy.fetch(new Request('https://quiz.hasit.in/api/ai', {
    method: 'POST',
    headers: {
      ...authHeaders,
      Origin: 'https://attacker.example',
    },
    body: JSON.stringify({ model: 'gemini-2.5-flash', messages: [{ role: 'user', content: 'hi' }] }),
  }), testEnv);
  assert.equal(forbidden.status, 403);

  // Test invalid model
  const invalidModel = await quizAiProxy.fetch(new Request('https://quiz.hasit.in/api/ai', {
    method: 'POST',
    headers: {
      ...authHeaders,
      Origin: 'https://quiz.hasit.in',
    },
    body: JSON.stringify({ model: 'unexpected', messages: [{ role: 'user', content: 'hi' }] }),
  }), testEnv);
  assert.equal(invalidModel.status, 400);

  // Test preflight
  const preflight = await quizAiProxy.fetch(new Request('https://quiz.hasit.in/api/ai', {
    method: 'OPTIONS',
    headers: { Origin: 'https://quiz.hasit.in' },
  }), testEnv);
  assert.equal(preflight.status, 204);
});
