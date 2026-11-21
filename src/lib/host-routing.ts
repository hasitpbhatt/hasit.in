/**
 * Hostname -> app routing.
 *
 * Pure on purpose: no Worker globals, no I/O. The router is the one piece of
 * logic that decides which app owns a request, so it is the seam we test.
 */

export type AppKey =
  | ''
  | 'trx'
  | 'freellm'
  | 'fitness'
  | 'finance'
  | 'blog'
  | 'quiz'
  | 'games'
  | 'auth';

/** Subdomains that map to an app key. Everything else falls back to portfolio. */
const SUBDOMAIN_APPS: Record<string, AppKey> = {
  trx: 'trx',
  trx2: 'trx',
  freellm: 'freellm',
  fitness: 'fitness',
  finance: 'finance',
  blog: 'blog',
  quiz: 'quiz',
  games: 'games',
  auth: 'auth',
};

const ROOT_DOMAIN = 'hasit.in';

/** True for localhost / loopback hostnames. */
export function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/:\d+$/, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
}

/**
 * Resolve a hostname to an app key.
 *
 * In production only real subdomains resolve; unknown hosts fall back to the
 * portfolio. On localhost we default to the TRX faucet so a single origin can
 * exercise the whole surface (plan.md Phase 4 endpoint table).
 */
export function resolveAppKey(hostname: string, local = isLocalHostname(hostname)): AppKey {
  const h = hostname.toLowerCase().replace(/:\d+$/, '');

  if (h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`) return '';

  if (h.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = h.slice(0, -1 * (`.${ROOT_DOMAIN}`.length));
    return SUBDOMAIN_APPS[sub] ?? '';
  }

  if (local) return 'trx';

  return '';
}
