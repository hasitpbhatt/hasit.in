/**
 * "Quote of the Day" and author navigation data for the TRX faucet.
 *
 * The old VPS version (trx.hasit.in, modeled on "Faucet in a BOX Ultimate")
 * showed a rotating daily quote plus a top-nav list of author links that point
 * at `?p=<slug>` pages. The unified Worker (trx2.hasit.in) is missing both.
 * This module is intentionally self-contained so templates.ts can wire it in
 * without pulling in any other dependencies.
 *
 * All quote text here is original and written in the spirit of the classic
 * faucet sections — no copyrighted passages are reproduced.
 */

import { escapeHtml } from './html.ts';

/** A top-nav author and the slug used by the VPS `?p=` pages. */
export interface Author {
  name: string;
  slug: string;
}

/**
 * Authors shown in the top navigation.
 *
 * Slugs mirror the live VPS links exactly (e.g. `?p=navalravikant`): the name
 * is lowercased and concatenated, with no spaces or punctuation.
 */
export const AUTHORS: readonly Author[] = [
  { name: 'Naval Ravikant', slug: 'navalravikant' },
  { name: 'Jordan Peterson', slug: 'jordanpeterson' },
  { name: 'Stephen Covey', slug: 'stephencovey' },
  { name: 'Charlie Munger', slug: 'charliemunger' },
  { name: 'Richard Feynman', slug: 'richardfeynman' },
  { name: 'Andrew Huberman', slug: 'andrewhuberman' },
  { name: 'David Deutsch', slug: 'daviddeutsch' },
];

/** A single themed quote. `text` deliberately omits the theme prefix. */
export interface Quote {
  theme: string;
  text: string;
}

/**
 * Quote pool. One entry per theme; the daily quote is selected by cycling
 * through this list, so each theme comes around on a predictable schedule.
 */
export const QUOTES: readonly Quote[] = [
  {
    theme: 'Relationships',
    text: 'Cherish the bonds you form with fellow travelers. Nurture authentic relationships built on empathy, respect, and reciprocity.',
  },
  {
    theme: 'Gratitude',
    text: 'Take a moment each day to notice what is going well. Gratitude turns ordinary moments into reasons to keep moving forward.',
  },
  {
    theme: 'Discipline',
    text: 'Small, consistent actions outlast bursts of inspiration. Choose the task in front of you and do it even when the mood is absent.',
  },
  {
    theme: 'Knowledge',
    text: 'Learning compounds quietly over a lifetime. Stay a student, ask better questions, and let curiosity guide you toward understanding.',
  },
  {
    theme: 'Work',
    text: 'Do work you can be proud of, even when no one is watching. Craft and care are their own quiet form of reward.',
  },
  {
    theme: 'Patience',
    text: 'Not everything worth having arrives quickly. Plant the seed, tend it faithfully, and trust the slow work of time.',
  },
  {
    theme: 'Courage',
    text: 'Courage is acting despite uncertainty, not the absence of fear. Take the honest step, however small, and let confidence follow.',
  },
  {
    theme: 'Wisdom',
    text: 'Wisdom is knowing which advice to ignore. Listen widely, think for yourself, and hold your conclusions lightly.',
  },
  {
    theme: 'Focus',
    text: 'Where attention goes, energy follows. Guard your focus as a scarce resource and give your best hours to what matters most.',
  },
  {
    theme: 'Integrity',
    text: 'Integrity is doing the right thing when it costs you something. Keep your word and let your actions match your principles.',
  },
  {
    theme: 'Curiosity',
    text: 'Curiosity is the engine of discovery. Follow the questions that surprise you and stay open to being wrong.',
  },
  {
    theme: 'Resilience',
    text: 'Setbacks are part of the path, not the end of it. Bend without breaking, learn the lesson, and begin again.',
  },
];

/** Milliseconds in a single UTC day. */
const MS_PER_DAY = 86_400_000;

/**
 * Deterministically selects the quote for a given moment.
 *
 * The UTC day number is used so every visitor sees the same quote on the same
 * calendar day, regardless of timezone, and the quote advances each day.
 *
 * @param nowMs - Timestamp in milliseconds; defaults to the current time.
 */
export function dailyQuote(nowMs: number = Date.now()): { theme: string; text: string } {
  const dayNumber = Math.floor(nowMs / MS_PER_DAY);
  return QUOTES[dayNumber % QUOTES.length];
}

/**
 * Renders the top-nav author list as Bootstrap-style inline links.
 *
 * Every interpolated value (base URL, slug, and name) is HTML-escaped so the
 * output is safe even if a caller passes an untrusted base URL.
 */
export function renderAuthorNav(baseUrl: string): string {
  const safeBaseUrl = escapeHtml(baseUrl);
  const items = AUTHORS.map(({ name, slug }) => {
    const href = `${safeBaseUrl}?p=${escapeHtml(slug)}`;
    return `<li><a href="${href}">${escapeHtml(name)}</a></li>`;
  });
  return `<ul class="list-inline author-nav">${items.join('')}</ul>`;
}

/**
 * Renders the "Quote of the Day" block. The quote is chosen by `dailyQuote`,
 * so it is stable for a given UTC day, and both fields are HTML-escaped.
 */
export function renderQuoteOfDay(nowMs?: number): string {
  const { theme, text } = dailyQuote(nowMs);
  return `<div class="quote-of-day"><h3>Quote of the Day:</h3><p><strong>${escapeHtml(theme)}:</strong> ${escapeHtml(text)}</p></div>`;
}
