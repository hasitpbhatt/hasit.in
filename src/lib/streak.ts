/**
 * Daily claim streak rules — pure, no DB.
 *
 * A "day" is a UTC day number. Consecutive claims on successive UTC days grow
 * the streak; a gap resets it to 1. Each streak day adds 5% to the reward,
 * capped at 30% (day 7). This keeps the average payout predictable while giving
 * users a reason to return daily.
 */
const DAY_MS = 86_400_000;
export const STREAK_BONUS_PER_DAY = 0.05;
export const STREAK_MAX_BONUS_DAYS = 6; // day 7 => +30%
export const STREAK_MAX_MULTIPLIER = 1 + STREAK_BONUS_PER_DAY * STREAK_MAX_BONUS_DAYS;

export interface StreakRow {
  streak: number;
  last_claim_day: number;
}

/** UTC day number for a given timestamp. */
export function utcDay(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / DAY_MS);
}

/**
 * Compute the streak that applies to a claim happening now, without mutating.
 * `lastDay === today` means an earlier claim today (daily-limit rule normally
 * prevents this, but stay safe): keep the streak unchanged.
 */
export function computeStreak(
  row: StreakRow | null | undefined,
  nowMs: number = Date.now()
): { streak: number; multiplier: number; day: number } {
  const day = utcDay(nowMs);
  let streak = 1;

  if (row && Number.isFinite(row.last_claim_day) && Number.isFinite(row.streak)) {
    if (row.last_claim_day === day) {
      streak = Math.max(1, row.streak);
    } else if (row.last_claim_day === day - 1) {
      streak = Math.max(1, row.streak) + 1;
    }
    // gap (or future day) => reset to 1
  }

  const bonusDays = Math.min(Math.max(streak - 1, 0), STREAK_MAX_BONUS_DAYS);
  const multiplier = 1 + bonusDays * STREAK_BONUS_PER_DAY;
  return { streak, multiplier, day };
}
