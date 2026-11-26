import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';

import { securityHeadersMiddleware } from '../src/middleware/security-headers.ts';
import type { Env } from '../src/env.ts';

import {
  edgeBanReason,
  edgeSignals,
  type SecuritySettings,
} from '../src/middleware/security.ts';

const settings: SecuritySettings = {
  countryBanList: ['CN', 'ru'],
  asnBanList: ['AS64500', '13335'],
  ipBanList: [],
  hostnameBanList: ['evil.example'],
  nastyhostsEnabled: false,
};

const empty: SecuritySettings = {
  countryBanList: [],
  asnBanList: [],
  ipBanList: [],
  hostnameBanList: [],
  nastyhostsEnabled: false,
};

test('CSP permits the external origins required by Turnstile and Quiz', async () => {
  const app = new Hono<{ Bindings: Env }>();
  app.use('*', securityHeadersMiddleware());
  app.get('/', (c) => c.text('ok'));

  const response = await app.request('/');
  const csp = response.headers.get('Content-Security-Policy') ?? '';

  assert.match(csp, /script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp, /connect-src[^;]*https:\/\/raw\.githubusercontent\.com/);
});

test('a Cloudflare country ban is enforced case-insensitively', () => {
  assert.equal(edgeBanReason(settings, { country: 'CN', asn: 1 }), 'Country banned');
  assert.equal(edgeBanReason(settings, { country: 'RU', asn: 1 }), 'Country banned');
});

test('a Cloudflare ASN ban accepts both AS-prefixed and bare entries', () => {
  assert.equal(edgeBanReason(settings, { country: 'US', asn: 64500 }), 'ASN banned');
  assert.equal(edgeBanReason(settings, { country: 'US', asn: 13335 }), 'ASN banned');
});

test('signals that do not match are allowed', () => {
  assert.equal(edgeBanReason(settings, { country: 'US', asn: 1 }), null);
  assert.equal(edgeBanReason(empty, { country: 'CN', asn: 64500 }), null);
});

test('the Host header is checked against the hostname ban list', () => {
  assert.equal(
    edgeBanReason(settings, { hostname: 'evil.example:8787' }),
    'Hostname banned'
  );
  assert.equal(edgeBanReason(settings, { hostname: 'hasit.in' }), null);
});

test('edgeSignals combines cf metadata with the Host header', () => {
  const request = new Request('https://trx.hasit.in/health', {
    headers: { Host: 'TRX.hasit.in:8787' },
  });
  Object.defineProperty(request, 'cf', { value: { country: 'US', asn: 13335 } });

  assert.deepEqual(edgeSignals(request), {
    country: 'US',
    asn: 13335,
    hostname: 'trx.hasit.in',
  });
});

test('a request without Cloudflare metadata is allowed', () => {
  assert.equal(edgeBanReason(settings, undefined), null);
});
