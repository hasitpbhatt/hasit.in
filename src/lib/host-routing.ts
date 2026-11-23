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

// Build output is staged under a private prefix. Clean browser URLs are
// rewritten to these paths by the Worker so /apps/... is never public.
const SPA_ASSET_ROOTS: Partial<Record<AppKey, string>> = {
  freellm: '/_spa/freellm/',
  fitness: '/_spa/fitness/',
  finance: '/_spa/finance/',
  quiz: '/_spa/quiz/',
  games: '/_spa/games/',
};

const FITNESS_LOCALES = ['gu', 'en', 'hi'] as const;

export function getSpaAssetRoot(appKey: AppKey): string | null {
  return SPA_ASSET_ROOTS[appKey] ?? null;
}

function normalizePath(pathname: string): string {
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_next/')
    || pathname.startsWith('/assets/')
    || /\.[a-z0-9]+$/i.test(pathname);
}

/** Internal asset paths to try for a clean browser URL, in priority order. */
export function resolveSpaAssetPaths(appKey: AppKey, pathname: string): string[] {
  const root = getSpaAssetRoot(appKey);
  if (!root) return [];

  const path = normalizePath(pathname);
  if (isStaticAssetPath(path)) return [`${root}${path.slice(1)}`];

  if (appKey === 'fitness') {
    if (path === '/') {
      return FITNESS_LOCALES.map((locale) => `${root}${locale}/index.html`);
    }

    const segments = path.slice(1).split('/').filter(Boolean);
    if (FITNESS_LOCALES.includes(segments[0] as (typeof FITNESS_LOCALES)[number])) {
      const rest = segments.slice(1).join('/');
      return [rest ? `${root}${segments[0]}/${rest}/index.html` : `${root}${segments[0]}/index.html`];
    }

    return FITNESS_LOCALES.flatMap((locale) => [
      `${root}${locale}${path}/index.html`,
      `${root}${locale}${path}.html`,
    ]);
  }

  return [`${root}index.html`];
}

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
