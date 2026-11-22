import { test } from 'node:test';
import assert from 'node:assert/strict';

import { financeApp } from '../src/apps/finance/index.ts';
import { quizApp } from '../src/apps/quiz/index.ts';

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

test('quiz AI proxy validates origin and request payload without contacting Mistral', async () => {
  const env = {
    MISTRAL_API_KEY: 'test-key',
  } as Parameters<typeof quizApp.fetch>[1];

  const forbidden = await quizApp.request('/api/ai', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: 'hi' }] }),
  }, env);
  assert.equal(forbidden.status, 403);

  const invalidModel = await quizApp.request('/api/ai', {
    method: 'POST',
    headers: {
      Origin: 'https://quiz.hasit.in',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'unexpected', messages: [{ role: 'user', content: 'hi' }] }),
  }, env);
  assert.equal(invalidModel.status, 400);

  const preflight = await quizApp.request('/api/ai', {
    method: 'OPTIONS',
    headers: { Origin: 'https://quiz.hasit.in' },
  }, env);
  assert.equal(preflight.status, 204);
});
