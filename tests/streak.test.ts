import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeStreak, utcDay, STREAK_MAX_MULTIPLIER } from '../src/lib/streak.ts';

const DAY = 86_400_000;
const now = 1_800_000_000_000; // fixed instant
const day = utcDay(now);

test('first claim starts a 1-day streak with no bonus', () => {
  const r = computeStreak(null, now);
  assert.equal(r.streak, 1);
  assert.equal(r.multiplier, 1);
  assert.equal(r.day, day);
});

test('claiming again on the same UTC day keeps the streak', () => {
  const r = computeStreak({ streak: 4, last_claim_day: day }, now);
  assert.equal(r.streak, 4);
  assert.equal(r.multiplier, 1.15);
});

test('claiming on the next UTC day increments the streak', () => {
  const r = computeStreak({ streak: 3, last_claim_day: day - 1 }, now);
  assert.equal(r.streak, 4);
  assert.equal(r.multiplier, 1.15);
});

test('a gap resets the streak to 1', () => {
  const r = computeStreak({ streak: 9, last_claim_day: day - 3 }, now);
  assert.equal(r.streak, 1);
  assert.equal(r.multiplier, 1);
});

test('bonus is capped at day 7', () => {
  const r = computeStreak({ streak: 20, last_claim_day: day - 1 }, now);
  assert.equal(r.streak, 21);
  assert.equal(r.multiplier, STREAK_MAX_MULTIPLIER);
  assert.equal(r.multiplier, 1.3);
});

test('malformed row is treated as a fresh streak', () => {
  const r = computeStreak({ streak: NaN, last_claim_day: NaN }, now);
  assert.equal(r.streak, 1);
  assert.equal(r.multiplier, 1);
});
