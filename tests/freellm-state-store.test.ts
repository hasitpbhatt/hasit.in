import { test } from 'node:test';
import assert from 'node:assert/strict';

import { D1FreellmStateStore } from '../src/apps/freellm/state-store.ts';
import { appPath } from '../apps/freellm/functions/lib/app-path.ts';
import { appPath as browserAppPath } from '../apps/freellm/src/lib/app-path.ts';

test('FreeLLM UI paths are rooted under the staged asset directory', () => {
  assert.equal(appPath('/login', '/apps/freellm'), '/apps/freellm/login');
  assert.equal(appPath('/apps/freellm/keys', '/apps/freellm'), '/apps/freellm/keys');
  assert.equal(appPath('/login'), '/login');
  assert.equal(browserAppPath('/login?next=/admin', '/apps/freellm/'), '/apps/freellm/login?next=/admin');
  assert.equal(browserAppPath('/chat', '/'), '/chat');
});

test('D1 state store preserves text and JSON values and expires entries', async () => {
  const rows = new Map<string, { value: string; expires_at_ms: number | null }>();
  const db = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              const row = rows.get(String(values[0]));
              return (row ? { ...row } : null) as T | null;
            },
            async run() {
              if (query.startsWith('INSERT')) {
                rows.set(String(values[0]), {
                  value: String(values[1]),
                  expires_at_ms: values[2] === null ? null : Number(values[2]),
                });
              } else {
                rows.delete(String(values[0]));
              }
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  const store = new D1FreellmStateStore(db);
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;
  try {
    await store.put('session', 'token', { expirationTtl: 2 });
    await store.put('oauth', JSON.stringify({ state: 'ok' }), { expiration: 5 });
    assert.equal(await store.get('session'), 'token');
    assert.deepEqual(await store.get('oauth', 'json'), { state: 'ok' });

    now = 3_000;
    assert.equal(await store.get('session'), null);
    assert.equal(rows.has('session'), false);
    assert.deepEqual(await store.get('oauth', 'json'), { state: 'ok' });
  } finally {
    Date.now = originalNow;
  }
});
