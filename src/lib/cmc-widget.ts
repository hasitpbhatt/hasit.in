/**
 * CoinMarketCap price widget + extra faucet footer links for the TRX faucet.
 *
 * This module is intentionally self-contained: it has no dependencies beyond
 * the local HTML escaper and exports only static, trusted markup helpers. Wire
 * `renderCmcWidget()` and `renderFaucetFooterLinks()` into the TRX templates
 * wherever the widget / footer links should appear.
 */

import { escapeHtml } from './html.ts';

/** CoinMarketCap's hosted widget script (loads the widget into the page). */
export const CMC_SCRIPT_URL = 'https://files.coinmarketcap.com/static/widget/currency.js';

/** CoinMarketCap's currency id for TRON (TRX). */
export const CMC_CURRENCY_ID = 1958;

/**
 * Render the full CoinMarketCap currency widget for TRX.
 *
 * The widget script turns the `coinmarketcap-currency-widget` div into a live
 * price block. Enabling rank / market cap / volume (plus the USD stats block)
 * makes it match the full widget shown on the old VPS faucet page.
 */
export function renderCmcWidget(): string {
  return `<script type="text/javascript" src="${CMC_SCRIPT_URL}"></script>
<div class="coinmarketcap-currency-widget"
     data-currencyid="${CMC_CURRENCY_ID}" data-base="USD" data-secondary="" data-ticker="true"
     data-rank="true" data-marketcap="true" data-volume="true" data-statsticker="true"
     data-stats="USD"></div>`;
}

/** A single footer link: a trusted label paired with a trusted destination. */
interface FooterLink {
  label: string;
  href: string;
}

/**
 * Extra footer links shown on the old VPS faucet page.
 *
 * `quiz` is the parity link that was missing from the current template.
 */
const FOOTER_LINKS: readonly FooterLink[] = [
  {
    label: 'Click this link for more crypto faucets',
    href: 'https://faucetlist.top/?r=TT7ZHznpSW3qjGwNaQWcshzcwQihhxGS6J&order=e',
  },
  {
    label: 'Share on Facebook',
    href: 'https://www.facebook.com/sharer/sharer.php?u=https://trx.hasit.in',
  },
  { label: 'blog', href: 'https://blog.hasit.in/' },
  { label: 'podcast', href: 'https://open.spotify.com/show/4ONLihbtq88dUDvTtGxT47' },
  { label: 'quiz', href: 'https://hasit.in/quiz.html' },
  {
    label: 'Faucet in a BOX Ultimate',
    href: 'https://faucetlist.top/faucet-in-a-box-ultimate',
  },
];

/**
 * Render the extra footer links as a centered paragraph.
 *
 * Labels and hrefs are static/trusted constants, but they still go through
 * `escapeHtml` before interpolation so the markup stays safe by construction.
 * (Escaping `&` in query strings to `&amp;` is valid HTML and browsers decode
 * it back to `&` when following the link.)
 */
export function renderFaucetFooterLinks(): string {
  const links = FOOTER_LINKS.map(
    ({ label, href }) =>
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
  ).join(' · ');

  return `<p class="faucet-footer-links text-center">${links}</p>`;
}
