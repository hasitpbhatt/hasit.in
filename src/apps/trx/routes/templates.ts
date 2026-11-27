// HTML templates for TRX faucet pages

import { escapeHtml } from '../../../lib/html';
import {
  renderAdSlot,
  renderAdsenseLoader,
  renderAnalyticsTags,
  type SiteConfig,
} from '../../../lib/site-config';
import { renderNoDataState } from '../../../lib/ui-components.ts';
import { renderAuthorNav, renderQuoteOfDay } from '../../../lib/quotes.ts';
import { renderCmcWidget, renderFaucetFooterLinks } from '../../../lib/cmc-widget.ts';

export interface ClaimPageData {
  page: 'eligible' | 'paid' | 'visit_later' | 'disabled';
  timer: number;
  rewards: string;
  claimsLeft: number;
  balance: string;
  turnstileSiteKey: string;
  address: string;
  refLink: string;
  ref: string;
  recentPayouts: PayoutRow[];
  referralPct: number;
  refUsers: string;
  sessionToken: string;
  csrf: string;
  trxHost: string;
  enabled: boolean;
  disallowEmail: boolean;
  streak: number;
  streakMultiplier: number;
  site: SiteConfig;
  flash: { message: string; type: string } | null;
}

export interface PayoutRow {
  address: string;
  time: number;
  reward: number;
}

function renderNav(): string {
  return `<nav class="nav" role="navigation" aria-label="Hasit.in Network">
  <div class="nav-inner">
    <a href="https://hasit.in" class="nav-logo" aria-label="Hasit.in Home">HB</a>
    ${renderAuthorNav('https://trx.hasit.in')}
    <div class="nav-links">
      <a href="https://hasit.in" class="nav-link">Home</a>
      <a href="https://blog.hasit.in" class="nav-link">Blog</a>
      <div class="nav-dropdown">
        <button class="nav-link nav-dropdown-trigger" aria-expanded="false" aria-haspopup="true">Apps ▾</button>
        <div class="nav-dropdown-menu" role="menu">
          <a href="https://trx.hasit.in" class="nav-dropdown-item" role="menuitem"><span class="nav-dropdown-icon">💰</span><span>TRX Faucet</span></a>
          <a href="https://freellm.hasit.in" class="nav-dropdown-item" role="menuitem"><span class="nav-dropdown-icon">🔑</span><span>FreeLLM</span></a>
          <a href="https://fitness.hasit.in" class="nav-dropdown-item" role="menuitem"><span class="nav-dropdown-icon">💪</span><span>Fitness</span></a>
          <a href="https://quizify.hasit.in" class="nav-dropdown-item" role="menuitem"><span class="nav-dropdown-icon">⚡</span><span>Quizify</span></a>
          <a href="https://airgap.hasit.in" class="nav-dropdown-item" role="menuitem"><span class="nav-dropdown-icon">🛡️</span><span>Airgap</span></a>
          <a href="https://devcheap.click" class="nav-dropdown-item" role="menuitem"><span class="nav-dropdown-icon">💰</span><span>DevCheap</span></a>
        </div>
      </div>
    </div>
  </div>
</nav>`;
}

function renderHead(data: ClaimPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hasit's Tron (TRX) Faucet</title>
  <meta name="keywords" content="trx,tron,trx faucet,tron faucet,free trx,crypto faucet,faucet,payments">
  <meta name="description" content="Claim free TRX on our TRON faucet! Get instant payouts, no fees, and enjoy a seamless experience. Withdraw instantly with Faucetpay!">
  <meta name="referrer" content="no-referrer">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="//cdn.jsdelivr.net/bootstrap/3.3.4/css/bootstrap.min.css">
  <link rel="stylesheet" href="/styles-trx.css">
  ${renderAnalyticsTags(data.site)}
  ${renderAdsenseLoader(data.site)}
</head>`;
}

function renderFlash(data: ClaimPageData): string {
  if (!data.flash) return '';
  const type = data.flash.type === 'error' ? 'danger' : data.flash.type === 'success' ? 'success' : 'info';
  return `<div class="alert alert-${type} text-center" role="alert">${escapeHtml(data.flash.message)}</div>`;
}

function renderHeader(data: ClaimPageData): string {
  return `<div class="container">
  ${renderAdSlot(data.site, 'ad-header')}

  <h1 class="trx-title text-center"><b>Hasit's Tron (TRX) Faucet</b></h1>
  <p class="trx-short">Claim free TRX on our TRON faucet! Instant FaucetPay payouts, no fees.</p>
  <p class="text-center text-muted disclaimer">I run this page just for fun, not a paid/unpaid promotion.</p>

  <div class="row">
    <div class="col-md-6">
      <div class="balance-panel">
        <strong>[TRX] Balance:</strong> <span id="trx-balance">${escapeHtml(data.balance)}</span> satoshi
      </div>
    </div>
    <div class="col-md-6">
      <div class="cmc-widget">
        <div class="price-ticker">
          <strong>TRX Price:</strong>
          ${renderCmcWidget()}
        </div>
      </div>
    </div>
  </div>

  <ul class="list-inline lead text-center payout-tiers">
    ${data.rewards
      .split(', ')
      .filter(Boolean)
      .map((r) => `<li><span class="frame box">• ${escapeHtml(r)}</span></li>`)
      .join('')}
  </ul>

  <p class="text-center claims-left"><strong>${data.claimsLeft >= 0 ? data.claimsLeft : '∞'}</strong> daily claims left.</p>
  ${data.streak > 1 ? `<p class="text-center streak-info">🔥 ${data.streak}-day streak — <strong>+${Math.round((data.streakMultiplier - 1) * 100)}%</strong> bonus on every claim</p>` : ''}`;
}

function renderClaimForm(data: ClaimPageData): string {
  if (data.page !== 'eligible') return '';

  return `<form action="/" method="post" id="claimForm" class="mt-3">
  <input type="hidden" name="session" value="${escapeHtml(data.sessionToken)}">
  <input type="hidden" name="csrf" value="${escapeHtml(data.csrf)}">
  <input type="hidden" name="ref" value="${escapeHtml(data.ref)}">
  <input type="hidden" name="input_name" value="trx_addr">

  <div class="form-group">
    <div class="row">
      <div class="col-lg-4 col form-group mb-2">
        <input type="text" class="form-control" id="trxAddress" name="address" placeholder="Tron (TRX) address" value="${escapeHtml(data.address)}" required ${!data.enabled ? 'disabled' : ''}>
      </div>
      <div class="col form-group mb-2">
        <div class="cf-turnstile" data-sitekey="${escapeHtml(data.turnstileSiteKey)}" data-theme="dark" data-action="claim" data-callback="trxTurnstileSolved" data-expired-callback="trxTurnstileExpired"></div>
      </div>
    </div>
  </div>

  <div id="game_area" data-game="trx">
    <h3 class="game-title">Match the Card Pairs</h3>
    <div class="game-header">
      <span class="trx-badge trx-badge-accent">Human Verification</span>
      <span class="trx-badge trx-badge-warning" id="game-progress">0/6 Pairs</span>
    </div>
    <div id="game_cards" class="game-cards"></div>
    <div id="game_status" class="game-status">Flip and match all emoji pairs to unlock the faucet claim.</div>
  </div>

  <button type="submit" class="btn btn-primary btn-block d-none" id="claimbtn" disabled ${!data.enabled ? 'disabled' : ''}>Claim your TRX!</button>
</form>`;
}

function renderVisitLaterPageContent(data: ClaimPageData): string {
  return `<p class="alert alert-info text-center">You have to wait ${escapeHtml(data.timer)} minutes before claiming again.</p>`;
}

function renderDisabledPageContent(): string {
  return `<p class="alert alert-danger text-center">FAUCET DISABLED. Go to <a href="/admin">admin page</a> and fill all required data!</p>`;
}

function renderReferralSection(data: ClaimPageData): string {
  return `<div class="referral-section panel panel-info">
  <div class="panel-heading">
    <h3 class="panel-title">Referral Program</h3>
  </div>
  <div class="panel-body">
    <p>Share this link with your friends and earn <strong>${escapeHtml(data.referralPct)}% referral commission</strong>.</p>
    <div class="form-group">
      <label>Your Referral Link:</label>
      <div class="input-group">
        <input type="text" class="form-control" id="referral-link" value="${escapeHtml(data.refLink)}" readonly>
        <span class="input-group-btn">
          <button class="btn btn-default copy-trigger" type="button" id="copy-referral" data-copy="${escapeHtml(data.refLink)}">Copy</button>
        </span>
      </div>
    </div>
    <p class="referral-stats">📒 Total referred users: <strong id="referral-count">${escapeHtml(data.refUsers)}</strong></p>
    <p class="text-muted small">Referral info appears here when you claim with a referral link (<code>?r=address</code>).</p>
  </div>
</div>`;
}

function renderRecentPayouts(payouts: PayoutRow[]): string {
  if (!payouts.length) {
    return renderNoDataState('No recent payouts yet', 'Payouts appear here once claims start flowing.');
  }

  return `<div id="recent-payouts">
    <h3>Recent Payouts</h3>
    <div class="table-responsive">
      <table class="table table-striped table-payments">
        <thead>
          <tr><th>Date</th><th class="text-center">Address</th><th class="text-right">Reward</th></tr>
        </thead>
        <tbody>
          ${payouts
            .map((p, i) => {
              const addr = p.address;
              const half = Math.ceil(addr.length / 2);
              return `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">
              <td>${escapeHtml(new Date(p.time * 1000).toLocaleString())}</td>
              <td class="text-center"><span class="line">${escapeHtml(addr.slice(0, half))}</span><span class="line">${escapeHtml(addr.slice(half))}</span></td>
              <td class="text-right">${escapeHtml(p.reward)} satoshi</td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderFooter(data: ClaimPageData): string {
  return `${renderFaucetFooterLinks()}

${renderAdSlot(data.site, 'ad-bottom')}`;
}

export function renderClaimPage(data: ClaimPageData): string {
  const content =
    data.page === 'visit_later'
      ? renderVisitLaterPageContent(data)
      : data.page === 'disabled'
        ? renderDisabledPageContent()
        : renderClaimForm(data) + renderReferralSection(data) + renderRecentPayouts(data.recentPayouts);

  return `${renderHead(data)}
<body>
${renderNav()}
${renderHeader(data)}
<div class="container">
${renderFlash(data)}
${content}
${renderQuoteOfDay()}
</div>
${renderFooter(data)}

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script src="/memory-game.js"></script>
<script>
  window.trx = {
    host: "${escapeHtml(data.trxHost)}",
    sessionToken: "${escapeHtml(data.sessionToken)}",
    csrf: "${escapeHtml(data.csrf)}",
  };
</script>
<script src="//cdn.jsdelivr.net/jquery/2.1.4/jquery.min.js"></script>
<script src="//cdn.jsdelivr.net/bootstrap/3.3.4/js/bootstrap.min.js"></script>
<script src="/interactions.js" defer></script>
</body>
</html>`;
}
