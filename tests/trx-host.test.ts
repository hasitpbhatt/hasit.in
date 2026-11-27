import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TRX_HOST,
  TRX_PUBLIC_ORIGIN,
  resolveTrxHost,
  resolveTrxOrigin,
} from '../src/lib/trx-host.ts';
import { renderFaucetFooterLinks } from '../src/lib/cmc-widget.ts';

function request(headers: Record<string, string>): Request {
  return new Request('https://example.test/', { headers });
}

test('resolveTrxHost keeps a known faucet host', () => {
  assert.equal(resolveTrxHost(request({ Host: 'trx2.hasit.in' })), 'trx2.hasit.in');
  assert.equal(resolveTrxHost(request({ Host: 'trx.hasit.in' })), 'trx.hasit.in');
});

test('resolveTrxHost strips the port and lowercases', () => {
  assert.equal(resolveTrxHost(request({ Host: 'TRX2.hasit.in:443' })), 'trx2.hasit.in');
});

test('resolveTrxHost falls back to the live host for unknown or missing hosts', () => {
  assert.equal(resolveTrxHost(request({ Host: 'evil.example.com' })), DEFAULT_TRX_HOST);
  assert.equal(resolveTrxHost(request({})), DEFAULT_TRX_HOST);
});

test('resolveTrxHost does not trust a spoofed X-Hasit-Host over a known Host', () => {
  assert.equal(
    resolveTrxHost(request({ Host: 'trx.hasit.in', 'X-Hasit-Host': 'evil.example.com' })),
    'trx.hasit.in',
  );
});

test('resolveTrxHost rejects a spoofed X-Hasit-Host that is not allowlisted', () => {
  assert.equal(
    resolveTrxHost(request({ 'X-Hasit-Host': 'evil.example.com' })),
    DEFAULT_TRX_HOST,
  );
});

test('resolveTrxOrigin builds absolute URLs on the derived host', () => {
  assert.equal(resolveTrxOrigin(request({ Host: 'trx.hasit.in' })), 'https://trx.hasit.in');
  assert.equal(resolveTrxOrigin(request({})), TRX_PUBLIC_ORIGIN);
});

test('the Facebook share link follows the faucet origin it was rendered for', () => {
  const html = renderFaucetFooterLinks('https://trx2.hasit.in');
  assert.match(html, /sharer\.php\?u=https:\/\/trx2\.hasit\.in/);
  assert.doesNotMatch(html, /u=https:\/\/trx\.hasit\.in/);
});

test('footer links still contains the static destinations', () => {
  const html = renderFaucetFooterLinks('https://trx2.hasit.in');
  assert.match(html, /https:\/\/blog\.hasit\.in\//);
  assert.match(html, /faucetlist\.top/);
});
