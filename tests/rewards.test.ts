import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRewards, pickReward, formatRewardsDisplay } from '../src/lib/validator.ts';

test('parseRewards reads Faucet-in-a-BOX range*weight format', () => {
  const r = parseRewards('12000-16000*90, 26000-34000*9.5, 120000*0.5');
  assert.equal(r.length, 3);
  assert.deepEqual(r[0], { weight: 90, min: 12000, max: 16000 });
  assert.deepEqual(r[1], { weight: 9.5, min: 26000, max: 34000 });
  assert.deepEqual(r[2], { weight: 0.5, min: 120000, max: 120000 });
});

test('parseRewards handles the legacy VPS seed string', () => {
  const r = parseRewards('3019-90559*98.95, 90559-150932*1, 3018631*0.05');
  assert.deepEqual(r[0], { weight: 98.95, min: 3019, max: 90559 });
  assert.deepEqual(r[2], { weight: 0.05, min: 3018631, max: 3018631 });
});

test('parseRewards skips malformed segments', () => {
  const r = parseRewards('bad, 100-200*5, , 300*0');
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { weight: 5, min: 100, max: 200 });
});

test('formatRewardsDisplay normalizes weights to percentages', () => {
  // Weights are normalized to sum 100: 90 + 0.5 = 90.5 => 99.45% / 0.55%.
  const display = formatRewardsDisplay(parseRewards('12000-16000*90, 120000*0.5'));
  assert.match(display, /99\.45%/);
  assert.match(display, /0\.55%/);
});

test('pickReward always returns a value inside a picked range', () => {
  const ranges = parseRewards('100-200*90, 1000-2000*10');
  for (let i = 0; i < 500; i += 1) {
    const v = pickReward(ranges);
    const inFirst = v >= 100 && v <= 200;
    const inSecond = v >= 1000 && v <= 2000;
    assert.ok(inFirst || inSecond, `reward ${v} outside all ranges`);
  }
});
