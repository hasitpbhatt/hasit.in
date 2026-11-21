import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveAppKey, isLocalHostname } from '../src/lib/host-routing.ts';

test('root domain serves the portfolio', () => {
  assert.equal(resolveAppKey('hasit.in'), '');
  assert.equal(resolveAppKey('www.hasit.in'), '');
});

test('known subdomains map to their app', () => {
  assert.equal(resolveAppKey('trx.hasit.in'), 'trx');
  assert.equal(resolveAppKey('freellm.hasit.in'), 'freellm');
  assert.equal(resolveAppKey('fitness.hasit.in'), 'fitness');
  assert.equal(resolveAppKey('finance.hasit.in'), 'finance');
  assert.equal(resolveAppKey('blog.hasit.in'), 'blog');
  assert.equal(resolveAppKey('quiz.hasit.in'), 'quiz');
  assert.equal(resolveAppKey('games.hasit.in'), 'games');
  assert.equal(resolveAppKey('auth.hasit.in'), 'auth');
});

test('trx2 is an alias of the faucet', () => {
  assert.equal(resolveAppKey('trx2.hasit.in'), 'trx');
});

test('unknown subdomains fall back to the portfolio', () => {
  assert.equal(resolveAppKey('devcheap.click'), '');
  assert.equal(resolveAppKey('nope.hasit.in'), '');
});

test('localhost defaults to the faucet so one origin exercises the surface', () => {
  assert.equal(resolveAppKey('localhost'), 'trx');
  assert.equal(resolveAppKey('127.0.0.1'), 'trx');
  assert.equal(resolveAppKey('localhost:8787'), 'trx');
});

test('hostnames are case insensitive and port tolerant', () => {
  assert.equal(resolveAppKey('TRX.HASIT.IN'), 'trx');
  assert.equal(resolveAppKey('trx.hasit.in:8787'), 'trx');
});

test('isLocalHostname recognises loopback only', () => {
  assert.equal(isLocalHostname('localhost'), true);
  assert.equal(isLocalHostname('127.0.0.1'), true);
  assert.equal(isLocalHostname('trx.hasit.in'), false);
});
