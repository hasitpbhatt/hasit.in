import { test } from 'node:test';
import assert from 'node:assert/strict';

import { escapeHtml } from '../src/lib/html.ts';

const AMP = String.fromCharCode(38);
const LT = AMP + 'lt;';
const GT = AMP + 'gt;';
const AMP_ENT = AMP + 'amp;';
const QUOT = AMP + 'quot;';
const APOS = AMP + '#39;';
const BACKTICK = AMP + '#96;';

test('escapeHtml escapes every HTML-significant character', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    LT + 'script' + GT + 'alert(' + QUOT + 'x' + QUOT + ')' + LT + '/script' + GT
  );
});

test('escapeHtml escapes ampersands before anything else', () => {
  assert.equal(escapeHtml('a & b'), 'a ' + AMP_ENT + ' b');
  assert.equal(escapeHtml('<'), LT);
});

test('escapeHtml neutralises quote-breakout payloads', () => {
  assert.equal(
    escapeHtml('" onerror="alert(1)'),
    QUOT + ' onerror=' + QUOT + 'alert(1)'
  );
  assert.equal(
    escapeHtml("' onerror='alert(1)"),
    APOS + ' onerror=' + APOS + 'alert(1)'
  );
  assert.equal(escapeHtml('`${x}`'), BACKTICK + '${x}' + BACKTICK);
});

test('escapeHtml renders null and undefined as empty string', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml leaves safe text untouched', () => {
  assert.equal(escapeHtml('TRX Address T123'), 'TRX Address T123');
});
