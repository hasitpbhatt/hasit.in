import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { trx, toSettingsMap } from '../../../lib/db/trx-queries';
import { faucetpay } from '../../../lib/faucetpay';
import { coingecko } from '../../../lib/coingecko';
import {
  isValidTRXAddress,
  verifyTurnstile,
  parseRewards,
  pickReward,
  formatRewardsDisplay,
  formatTRX,
  getClientIP,
  sanitizeInput,
} from '../../../lib/validator';
import {
  createClaimSession,
  readClaimSession,
  setClaimSessionCookie,
  clearClaimSession,
  createFlashCookie,
  clearFlashCookie,
  readFlashCookie,
  validateCSRF,
} from '../../../middleware/session';
import { rateLimitMiddleware, strictRateLimitMiddleware } from '../../../middleware/rate-limit';
import { strictSecurityMiddleware } from '../../../middleware/security';
import { getSiteConfig } from '../../../lib/site-config';
import type { Env } from '../../../env';
import { renderClaimPage, type PayoutRow } from './templates';

export const claimRoutes = new Hono<{ Bindings: Env }>();

claimRoutes.use('*', cors({
  origin: ['https://trx.hasit.in', 'https://trx2.hasit.in'],
  credentials: true,
}));

claimRoutes.use('*', rateLimitMiddleware('trx'));

// GET / - Main claim page
claimRoutes.get('/', async (c) => {
  const ip = getClientIP(c.req.raw);
  const address = c.req.query('address') || '';
  const ref = c.req.query('r') || '';

  const settings = await trx.settings.getAll(c.env.DB);
  const settingsMap = toSettingsMap(settings.results ?? []);

  const timer = parseInt(settingsMap.get('timer') || '5', 10);
  const rewardsStr = settingsMap.get('rewards') || '3019-90559*98.95, 90559-150932*1, 3018631*0.05';
  const referralPct = parseInt(settingsMap.get('referral') || '50', 10);
  const limit24h = parseInt(settingsMap.get('limit_number_of_claims_per_24h') || '3', 10);
  const disallowEmail = settingsMap.get('disallow_email_claiming') === 'on';
  const balance = settingsMap.get('balance') || 'N/A';
  const turnstileSiteKey = settingsMap.get('turnstile_site_key') || c.env.TURNSTILE_SITE_KEY;

  const price = await coingecko.getPrice(c.env, 'TRX');

  const rewards = parseRewards(rewardsStr);
  const rewardsDisplay = formatRewardsDisplay(rewards);

  const apikey = settingsMap.get('apikey') || c.env.FAUCETPAY_API_KEY;
  const enabled = !!(apikey && turnstileSiteKey && rewards.length > 0);

  const addressEligible = !address || !disallowEmail || !address.includes('@');
  const timeLeftIp = await checkTimeLeft(c.env.DB, 'ip', ip, timer);
  const timeLeftAddr = address ? await checkTimeLeft(c.env.DB, 'address', address, timer) : 0;
  const eligible = timeLeftIp === 0 && timeLeftAddr === 0 && addressEligible;

  let claimsLeft = -1;
  if (limit24h > 0 && address) {
    const countResult = await trx.claimlog.countLast24h(c.env.DB, address, ip);
    const count = (countResult?.count as number) || 0;
    claimsLeft = count >= limit24h ? 0 : limit24h - count;
  }

  let page: 'eligible' | 'visit_later' | 'disabled' = 'eligible';
  if (!enabled) page = 'disabled';
  else if (!eligible) page = 'visit_later';

  const refLink = `https://trx.hasit.in/?r=${address || 'YOUR_ADDRESS'}`;

  const recentPayouts = await trx.claimlog.recent(c.env.DB, 10);
  const payouts: PayoutRow[] = recentPayouts.results.map((row) => ({
    address: String(row.address ?? ''),
    time: Number(row.time ?? 0),
    reward: Number(row.reward ?? 0),
  }));

  let sessionToken = '';
  let csrf = '';
  if (page === 'eligible' && address) {
    sessionToken = await createClaimSession(c.env, address);
    const session = await readClaimSession(c.env, sessionToken);
    csrf = session?.csrf ?? '';
  }

  const flash = readFlashCookie(c.req.header('Cookie') ?? null);

  const html = renderClaimPage({
    page,
    timer,
    rewards: rewardsDisplay,
    claimsLeft,
    balance,
    price,
    turnstileSiteKey,
    address: sanitizeInput(address),
    refLink,
    ref,
    recentPayouts: payouts,
    referralPct,
    refUsers: settingsMap.get('ref_users') || '0',
    sessionToken,
    csrf,
    enabled,
    disallowEmail,
    site: getSiteConfig(c.env),
    flash,
  });

  const headers = new Headers();
  if (sessionToken) headers.append('Set-Cookie', setClaimSessionCookie(sessionToken, c.env));
  if (flash) headers.append('Set-Cookie', clearFlashCookie(c.env));
  headers.set('Content-Type', 'text/html; charset=utf-8');

  return new Response(html, { headers });
});

// POST / - Process claim
//
// The memory game is client side and proves nothing to the server. The gates
// that matter are Turnstile, the rate limit and the claim limits below.
claimRoutes.post(
  '/',
  strictRateLimitMiddleware('trx', 3, 60_000), // 3 claims per minute max
  strictSecurityMiddleware(),
  async (c) => {
    const formData = await c.req.formData();
    const address = sanitizeInput((formData.get('address') as string) || '');
    const turnstileToken = (formData.get('cf-turnstile-response') as string) || '';
    const sessionToken = (formData.get('session') as string) || '';
    const csrf = (formData.get('csrf') as string) || '';
    const ref = sanitizeInput((formData.get('ref') as string) || '');

    const settings = await trx.settings.getAll(c.env.DB);
    const settingsMap = toSettingsMap(settings.results ?? []);
    const turnstileSecret = settingsMap.get('turnstile_secret') || c.env.TURNSTILE_SECRET;
    const timer = parseInt(settingsMap.get('timer') || '5', 10);
    const rewardsStr = settingsMap.get('rewards') || '';
    const referralPct = parseInt(settingsMap.get('referral') || '50', 10);
    const limit24h = parseInt(settingsMap.get('limit_number_of_claims_per_24h') || '3', 10);
    const disallowEmail = settingsMap.get('disallow_email_claiming') === 'on';

    const ip = getClientIP(c.req.raw);

    const session = await readClaimSession(c.env, sessionToken);
    if (!session || session.address !== address) {
      return c.json({ error: 'Invalid session' }, 400);
    }

    if (!validateCSRF(session.csrf, csrf)) {
      return c.json({ error: 'Invalid CSRF token' }, 400);
    }

    if (!isValidTRXAddress(address)) {
      return c.json({ error: 'Invalid TRX address' }, 400);
    }

    if (disallowEmail && address.includes('@')) {
      return c.json({ error: 'Email addresses not allowed' }, 400);
    }

    const timeLeftIp = await checkTimeLeft(c.env.DB, 'ip', ip, timer);
    const timeLeftAddr = await checkTimeLeft(c.env.DB, 'address', address, timer);
    if (timeLeftIp > 0 || timeLeftAddr > 0) {
      return c.json({ error: 'Please wait before claiming again' }, 429);
    }

    if (limit24h > 0) {
      const countResult = await trx.claimlog.countLast24h(c.env.DB, address, ip);
      const count = (countResult?.count as number) || 0;
      if (count >= limit24h) {
        return c.json({ error: 'Daily claim limit reached' }, 429);
      }
    }

    const captchaValid = await verifyTurnstile(turnstileToken, turnstileSecret, ip);
    if (!captchaValid) {
      return c.json({ error: 'Invalid captcha' }, 400);
    }

    await trx.locks.acquire(c.env.DB, 'ip', ip);
    await trx.locks.acquire(c.env.DB, 'address', address);

    try {
      const rewards = parseRewards(rewardsStr);
      const reward = pickReward(rewards);

      const result = await faucetpay.sendCoins(c.env, address, reward, ip);

      if (!result.success) {
        if (result.status === 403 || result.status === 452) {
          await trx.settings.set(c.env.DB, 'apikey', '');
          await trx.claimlog.setBalance(c.env.DB, '0');
        }

        const flash = createFlashCookie(result.message || 'Payment failed', 'error', c.env);
        return c.body(null, 302, { Location: '/', 'Set-Cookie': flash });
      }

      await trx.claimlog.insert(c.env.DB, { address, ip, reward, shortlink: '' });
      await trx.ips.setLastUsed(c.env.DB, ip);
      await trx.addresses.setLastUsed(c.env.DB, address);

      if (result.balance?.balance) {
        await trx.claimlog.setBalance(c.env.DB, result.balance.balance);
      }

      if (ref && ref !== address && isValidTRXAddress(ref)) {
        const refRecord = await trx.refs.getByAddress(c.env.DB, ref);
        if (refRecord) {
          const refAmount = Math.floor((reward * referralPct) / 100);
          if (refAmount > 0) {
            await faucetpay.sendReferralEarnings(c.env, ref, refAmount, ip);
          }
        }
      }

      const headers = new Headers({ Location: '/' });
      headers.append('Set-Cookie', clearClaimSession(c.env));
      headers.append(
        'Set-Cookie',
        createFlashCookie(`Successfully claimed ${formatTRX(reward)}!`, 'success', c.env)
      );
      return new Response(null, { status: 302, headers });
    } finally {
      await trx.locks.release(c.env.DB, 'ip', ip);
      await trx.locks.release(c.env.DB, 'address', address);
    }
  }
);

// Helper functions
async function checkTimeLeft(
  db: D1Database,
  kind: 'ip' | 'address',
  key: string,
  timerMinutes: number
): Promise<number> {
  const row = kind === 'ip'
    ? await trx.ips.getLastUsed(db, key)
    : await trx.addresses.getLastUsed(db, key);
  if (!row) return 0;

  const lastUsedMs = Number((row as Record<string, unknown>).last_used ?? 0) * 1000;
  if (!lastUsedMs) return 0;

  const elapsed = Date.now() - lastUsedMs;
  const windowMs = timerMinutes * 60 * 1000;
  return Math.max(0, Math.ceil((windowMs - elapsed) / 60000));
}
