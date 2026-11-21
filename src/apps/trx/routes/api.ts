import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { trx, toSettingsMap } from '../../../lib/db/trx-queries';
import { coingecko } from '../../../lib/coingecko';
import { parseRewards } from '../../../lib/validator';
import { getClientIP } from '../../../lib/validator';
import { rateLimitMiddleware } from '../../../middleware/rate-limit';
import type { Env } from '../../../env';

export const apiRoutes = new Hono<{ Bindings: Env }>();

apiRoutes.use('*', cors({
  origin: ['https://trx.hasit.in', 'https://trx2.hasit.in'],
  credentials: true,
}));

apiRoutes.use('*', rateLimitMiddleware('trx'));

// GET /api/price - Get TRX price
apiRoutes.get('/price', async (c) => {
  const price = await coingecko.getPrice(c.env, 'TRX');
  
  if (!price) {
    return c.json({ error: 'Price unavailable' }, 503);
  }
  
  return c.json({
    symbol: 'TRX',
    usd: price.usd,
    usd_24h_change: price.usd_24h_change,
    btc: price.btc,
    last_updated: price.last_updated,
  });
});

// GET /api/stats - Get faucet stats
apiRoutes.get('/stats', async (c) => {
  const totalClaims = await c.env.DB.prepare('SELECT COUNT(*) as count FROM trx_claimlog WHERE address != \'\'').first();
  const totalUsers = await c.env.DB.prepare('SELECT COUNT(DISTINCT address) as count FROM trx_claimlog WHERE address != \'\'').first();
  const totalPaid = await c.env.DB.prepare('SELECT SUM(reward) as total FROM trx_claimlog WHERE address != \'\'').first();
  const balance = await trx.claimlog.getBalance(c.env.DB);
  
  return c.json({
    totalClaims: (totalClaims?.count as number) || 0,
    totalUsers: (totalUsers?.count as number) || 0,
    totalPaid: (totalPaid?.total as number) || 0,
    balance: balance?.value || 'N/A',
  });
});

// GET /api/referral/:address - Get referral stats
apiRoutes.get('/referral/:address', async (c) => {
  const address = c.req.param('address');
  
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return c.json({ error: 'Invalid address' }, 400);
  }
  
  const referred = await trx.refs.getReferredUsers(c.env.DB, address);
  const count = referred.results.length;
  
  return c.json({
    address,
    referredCount: count,
    referredUsers: referred.results.map(r => ({
      address: r.address,
      lastUsed: r.last_used,
    })),
  });
});

// GET /api/claims/:address - Get user claim history
apiRoutes.get('/claims/:address', async (c) => {
  const address = c.req.param('address');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return c.json({ error: 'Invalid address' }, 400);
  }
  
  const claims = await trx.claimlog.byAddress(c.env.DB, address, limit);
  
  return c.json({
    address,
    claims: claims.results.map((row) => ({
      time: row.time,
      reward: row.reward,
      shortlink: row.shortlink,
    })),
  });
});

// GET /api/eligibility/:address - Check if address can claim
apiRoutes.get('/eligibility/:address', async (c) => {
  const address = c.req.param('address');
  const ip = getClientIP(c.req.raw);
  
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    return c.json({ error: 'Invalid address' }, 400);
  }
  
  const settings = await trx.settings.getAll(c.env.DB);
  const settingsMap = toSettingsMap(settings.results ?? []);
  const timer = parseInt(settingsMap.get('timer') || '5', 10) * 60 * 1000;
  const limit24h = parseInt(settingsMap.get('limit_number_of_claims_per_24h') || '3', 10);
  const disallowEmail = settingsMap.get('disallow_email_claiming') === 'on';
  
  if (disallowEmail && address.includes('@')) {
    return c.json({ eligible: false, reason: 'Email addresses not allowed' });
  }
  
  // Check IP time
  const ipResult = await trx.ips.getLastUsed(c.env.DB, ip);
  const ipTimeLeft = ipResult
    ? Math.max(0, timer - (Date.now() - Number((ipResult as Record<string, unknown>).last_used ?? 0) * 1000))
    : 0;

  // Check address time
  const addrResult = await trx.addresses.getLastUsed(c.env.DB, address);
  const addrTimeLeft = addrResult
    ? Math.max(0, timer - (Date.now() - Number((addrResult as Record<string, unknown>).last_used ?? 0) * 1000))
    : 0;
  
  // Check daily limit
  let claimsLeft = -1;
  if (limit24h > 0) {
    const countResult = await trx.claimlog.countLast24h(c.env.DB, address, ip);
    const count = (countResult?.count as number) || 0;
    claimsLeft = Math.max(0, limit24h - count);
  }
  
  const eligible = ipTimeLeft === 0 && addrTimeLeft === 0 && (claimsLeft === -1 || claimsLeft > 0);
  
  return c.json({
    eligible,
    ipTimeLeft: Math.ceil(ipTimeLeft / 1000 / 60),
    addressTimeLeft: Math.ceil(addrTimeLeft / 1000 / 60),
    claimsLeft,
    timerMinutes: timer / 60000,
  });
});

// GET /api/config - Report faucet readiness (no secrets leaked)
apiRoutes.get('/config', async (c) => {
  const settings = await trx.settings.getAll(c.env.DB);
  const settingsMap = toSettingsMap(settings.results ?? []);

  const apikey = settingsMap.get('apikey') || c.env.FAUCETPAY_API_KEY || '';
  const turnstileSiteKey = settingsMap.get('turnstile_site_key') || c.env.TURNSTILE_SITE_KEY || '';
  const turnstileSecret = settingsMap.get('turnstile_secret') || c.env.TURNSTILE_SECRET || '';
  const rewardsStr = settingsMap.get('rewards') || '3019-90559*98.95, 90559-150932*1, 3018631*0.05';
  const rewards = parseRewards(rewardsStr);
  const hasJwtKeys = Boolean(c.env.JWT_PRIVATE_KEY && c.env.JWT_PUBLIC_KEY);

  return c.json({
    app: 'trx-faucet',
    environment: c.env.ENVIRONMENT,
    ready: Boolean(apikey && turnstileSiteKey && turnstileSecret && rewards.length > 0 && hasJwtKeys),
    checks: {
      faucetpayKey: Boolean(apikey),
      turnstileSiteKey: Boolean(turnstileSiteKey),
      turnstileSecret: Boolean(turnstileSecret),
      jwtKeys: hasJwtKeys,
      rewardTiers: rewards.length,
      adminPasswordSet: Boolean(settingsMap.get('password')),
    },
    timerMinutes: parseInt(settingsMap.get('timer') || '5', 10),
  });
});

// GET /api/balance - Get faucet balance
apiRoutes.get('/balance', async (c) => {
  const balance = await trx.claimlog.getBalance(c.env.DB);
  return c.json({
    balance: balance?.value || '0',
  });
});