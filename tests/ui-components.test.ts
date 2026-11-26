import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderStatusBadge,
  renderPollingStatusBadge,
  renderEmptyState,
  renderNoDataState,
  renderSearchEmptyState,
  renderErrorState,
  renderLoadingState,
  renderTokenReveal,
  pollingStatusBadge,
  statusBadge,
  emptyState,
  tokenReveal,
} from '../src/lib/ui-components.ts';

const AMP = String.fromCharCode(38);
const LT = AMP + 'lt;';
const GT = AMP + 'gt;';
const QUOT = AMP + 'quot;';

test('renderStatusBadge escapes unsafe label and keeps class normalized', () => {
  const out = renderStatusBadge('<img>', 'bad-tone', { className: '" onerror=x' });
  assert.match(out, /status-badge--neutral/);
  assert.match(out, new RegExp(LT + 'img' + GT));
  assert.ok(!out.includes('" onerror=x'));
});

test('renderStatusBadge live polling attributes', () => {
  const out = renderPollingStatusBadge({ label: 'Live', polling: true, endpoint: 'https://x/?a=1&b=2', interval: 5000 });
  assert.match(out, /data-status-live="true"/);
  assert.match(out, /data-poll-endpoint="https:\/\/x\/\?a=1&amp;b=2"/);
  assert.match(out, /data-poll-interval="5000"/);
});

test('renderEmptyState escapes XSS in title/description/actions', () => {
  const out = renderEmptyState({
    title: '<script>alert(1)</script>',
    description: 'q" onerror="x',
    actions: [{ label: 'Click', href: 'javascript:alert(1)', variant: 'primary' }],
  });
  assert.match(out, new RegExp(LT + 'script'));
  assert.ok(!out.includes('<script>alert'));
  assert.match(out, /href="javascript:alert\(1\)"/);
});

test('renderNoDataState variants produce classes', () => {
  const out = renderNoDataState('Title', 'Desc', { size: 'lg', variant: 'plain' });
  assert.match(out, /empty-state--plain/);
  assert.match(out, /empty-state--lg/);
});

test('renderSearchEmptyState includes query', () => {
  const out = renderSearchEmptyState('term');
  assert.match(out, /No results for &quot;term&quot;/);
});

test('renderErrorState defaults', () => {
  const out = renderErrorState();
  assert.match(out, /Something went wrong/);
});

test('renderLoadingState plain', () => {
  const out = renderLoadingState('Loading data');
  assert.match(out, /empty-state--plain/);
  assert.match(out, /Loading data/);
});

test('renderTokenReveal keeps token in data-token and secret hidden', () => {
  const out = renderTokenReveal({ token: 'secret123', label: 'API Key', copy: true });
  assert.match(out, /data-token="secret123"/);
  assert.match(out, /token-reveal__secret/);
  assert.match(out, /hidden/);
  assert.match(out, /Reveal/);
  assert.match(out, /Copy/);
});

test('renderTokenReveal aliases work', () => {
  assert.ok(tokenReveal({ token: 'x' }).includes('token-reveal'));
  assert.ok(statusBadge({ label: 'ok' }).includes('status-badge'));
  assert.ok(emptyState({ title: 'none' }).includes('empty-state'));
  assert.ok(pollingStatusBadge('Live', 'success').includes('status-badge--success'));
});

test('empty raw result stable', () => {
  assert.ok(renderEmptyState().includes('empty-state'));
  assert.ok(renderTokenReveal().includes('token-reveal'));
});
