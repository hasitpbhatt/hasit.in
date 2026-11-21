import type { MiddlewareHandler } from 'hono';

import { getClientIP } from '../lib/validator.ts';
import type { Env } from '../env';

type SecuredEnv = { Bindings: Env };

/** Security settings loaded from trx_settings. */
export interface SecuritySettings {
  countryBanList: string[];
  asnBanList: string[];
  ipBanList: string[];
  hostnameBanList: string[];
  nastyhostsEnabled: boolean;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  countryBanList: [],
  asnBanList: [],
  ipBanList: [],
  hostnameBanList: [],
  nastyhostsEnabled: false,
};

/** The request signals used by the ban lists. */
export interface EdgeSignals {
  country?: string;
  asn?: number;
  hostname?: string;
}

/** Cloudflare's cf metadata plus the incoming Host header. */
export function edgeSignals(request: Request): EdgeSignals {
  const cf = request.cf as EdgeSignals | undefined;
  const hostname = (request.headers.get('Host') ?? '').toLowerCase().replace(/:\d+$/, '');
  return { ...cf, hostname };
}

/**
 * Cloudflare's country and ASN are authoritative for the connection, so a
 * cached 'allow' from a third-party provider must never bypass these bans.
 */
export function edgeBanReason(
  settings: SecuritySettings,
  signals: EdgeSignals | undefined
): string | null {
  if (!signals) return null;

  const country = signals.country?.toUpperCase();
  if (country && settings.countryBanList.some((entry) => entry.toUpperCase() === country)) {
    return 'Country banned';
  }

  const asn = signals.asn == null ? null : String(signals.asn);
  if (asn && settings.asnBanList.some((entry) => entry.replace(/^AS/i, '') === asn)) {
    return 'ASN banned';
  }

  const hostname = signals.hostname?.toLowerCase().replace(/:\d+$/, '');
  if (hostname && settings.hostnameBanList.some((entry) => entry.toLowerCase() === hostname)) {
    return 'Hostname banned';
  }

  return null;
}

let cachedSettings: SecuritySettings | null = null;
let settingsTimestamp = 0;
const SETTINGS_TTL = 300_000; // 5 minutes

/**
 * Load ban lists and provider toggles.
 *
 * Fails open: if the settings table cannot be read we return defaults instead
 * of throwing, because this runs in front of every request and a database
 * hiccup must not take the whole site down.
 */
async function loadSecuritySettings(env: Env): Promise<SecuritySettings> {
  const now = Date.now();
  if (cachedSettings && now - settingsTimestamp < SETTINGS_TTL) {
    return cachedSettings;
  }

  try {
    const rows = await env.DB.prepare(`
      SELECT name, value FROM trx_settings
      WHERE name IN ('country_ban_list', 'asn_ban_list', 'ip_ban_list', 'hostname_ban_list', 'nastyhosts_enabled')
    `).all();

    const settings: Record<string, string> = {};
    for (const row of rows.results ?? []) {
      settings[String(row.name)] = String(row.value ?? '');
    }

    const parseList = (val: string) => (val ? val.split(/[,\s;]+/).filter(Boolean) : []);

    cachedSettings = {
      countryBanList: parseList(settings.country_ban_list || ''),
      asnBanList: parseList(settings.asn_ban_list || ''),
      ipBanList: parseList(settings.ip_ban_list || ''),
      hostnameBanList: parseList(settings.hostname_ban_list || ''),
      nastyhostsEnabled: settings.nastyhosts_enabled === 'on',
    };

    settingsTimestamp = now;
    return cachedSettings;
  } catch (err) {
    console.error('Security settings load failed:', err);
    return DEFAULT_SETTINGS;
  }
}

function ipMatchesCIDR(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;

  const [rangeIp, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);
  if (Number.isNaN(mask) || mask < 0 || mask > 32) return false;

  // `1 << 32` is `1 << 0` in JavaScript, so the generic mask fails for /0.
  if (mask === 0) return ipToNumber(ip) !== null;

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(rangeIp);
  if (ipNum === null || rangeNum === null) return false;

  const maskNum = ~((1 << (32 - mask)) - 1);
  return (ipNum & maskNum) === (rangeNum & maskNum);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (Number.isNaN(octet) || octet < 0 || octet > 255) return null;
    value = (value << 8) + octet;
  }
  return value >>> 0;
}

/** Check Cloudflare signals, then cached and live proxy results. */
async function checkVPN(
  env: Env,
  ip: string,
  signals: EdgeSignals
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await loadSecuritySettings(env);

  const edgeReason = edgeBanReason(settings, signals);
  if (edgeReason) return { allowed: false, reason: edgeReason };

  for (const ban of settings.ipBanList) {
    if (ipMatchesCIDR(ip, ban)) {
      return { allowed: false, reason: 'IP banned' };
    }
  }

  try {
    const cached = await env.DB.prepare('SELECT data FROM trx_ProxyCheck WHERE ip = ? AND time > ?')
      .bind(ip, Math.floor(Date.now() / 1000) - 604800) // 7 days
      .first();

    if (cached?.data) {
      const data = JSON.parse(String(cached.data)) as {
        suggestion?: string;
        message_client?: string;
        service?: string;
      };
      if (data.suggestion === 'deny') {
        return { allowed: false, reason: data.message_client || 'VPN/Proxy detected' };
      }
      return { allowed: true };
    }
  } catch (err) {
    console.error('Proxy cache lookup failed:', err);
  }

  if (!settings.nastyhostsEnabled) return { allowed: true };

  const results = await Promise.allSettled([checkNastyHosts(ip)]);

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.suggestion === 'deny') {
      const denied = result.value;
      try {
        await env.DB.prepare('INSERT OR REPLACE INTO trx_ProxyCheck (ip, time, data) VALUES (?, ?, ?)')
          .bind(ip, Math.floor(Date.now() / 1000), JSON.stringify(denied)).run();
      } catch (err) {
        console.error('Proxy cache write failed:', err);
      }
      return { allowed: false, reason: denied.message_client || 'VPN/Proxy detected' };
    }
  }

  try {
    await env.DB.prepare('INSERT OR REPLACE INTO trx_ProxyCheck (ip, time, data) VALUES (?, ?, ?)')
      .bind(ip, Math.floor(Date.now() / 1000), JSON.stringify({ suggestion: 'allow', message_client: '' })).run();
  } catch (err) {
    console.error('Proxy cache write failed:', err);
  }

  return { allowed: true };
}

async function checkNastyHosts(ip: string) {
  try {
    const response = await fetch(`https://v1.nastyhosts.com/${ip}?source=hasit`, {
      headers: { 'User-Agent': 'hasit-in/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const data = (await response.json()) as {
      status?: number;
      suggestion?: string;
      service?: string;
    };
    if (data.status === 200) {
      return { suggestion: data.suggestion, message_client: `Blocked by ${data.service || 'NastyHosts'}` };
    }
  } catch {
    // provider unavailable -> not a reason to block
  }
  return null;
}

/**
 * Cheap checks for every request: Cloudflare country/ASN and the IP ban list.
 *
 * The expensive proxy lookup runs in strictSecurityMiddleware on the endpoints
 * that actually pay out.
 */
export function securityMiddleware(): MiddlewareHandler<SecuredEnv> {
  return async (c, next) => {
    const ip = getClientIP(c.req.raw);
    const settings = await loadSecuritySettings(c.env);

    const edgeReason = edgeBanReason(settings, edgeSignals(c.req.raw));
    if (edgeReason) return c.json({ error: edgeReason }, 403);

    for (const ban of settings.ipBanList) {
      if (ipMatchesCIDR(ip, ban)) {
        return c.json({ error: 'Access denied' }, 403);
      }
    }

    c.set('clientIP', ip);

    await next();
  };
}

/** Strict security for sensitive endpoints (claims, validations, payouts). */
export function strictSecurityMiddleware(): MiddlewareHandler<SecuredEnv> {
  return async (c, next) => {
    const ip = getClientIP(c.req.raw);

    const vpnCheck = await checkVPN(c.env, ip, edgeSignals(c.req.raw));
    if (!vpnCheck.allowed) {
      try {
        await c.env.DB.prepare(`
          INSERT INTO trx_NH_Log (time, ip, suggestion, reason)
          VALUES (unixepoch(), ?, ?, ?)
        `).bind(ip, 'deny', vpnCheck.reason || 'VPN/Proxy').run();
      } catch (err) {
        console.error('Security log write failed:', err);
      }

      return c.json({ error: vpnCheck.reason || 'VPN/Proxy not allowed' }, 403);
    }

    await next();
  };
}
