/**
 * Resolve the public faucet host from an incoming request.
 *
 * Pinning the host in templates is how every trx2 visitor ended up with a
 * referral link pointing at the legacy `trx.hasit.in` Pages app. Deriving it
 * from the request keeps referral links, share links and nav links on whichever
 * host the visitor actually used, and survives the planned `trx2` -> `trx` move
 * without another sweep for literals.
 */

/** Hosts the faucet may legitimately be served from. */
const TRX_HOSTS = new Set(['trx.hasit.in', 'trx2.hasit.in']);

/** Used when a request arrives without a usable Host header. */
export const DEFAULT_TRX_HOST = 'trx2.hasit.in';

/**
 * Public faucet origin used by pages that are NOT served on the faucet host
 * (the portfolio, marketing copy). Single place to change when the faucet moves
 * from `trx2.hasit.in` to `trx.hasit.in`.
 */
export const TRX_PUBLIC_ORIGIN = `https://${DEFAULT_TRX_HOST}`;

/** Resolve the public faucet host from the request, rejecting unknown hosts. */
export function resolveTrxHost(request: Request): string {
  const raw = request.headers.get('Host') || request.headers.get('X-Hasit-Host') || '';
  const hostname = raw.split(':')[0].trim().toLowerCase();
  return TRX_HOSTS.has(hostname) ? hostname : DEFAULT_TRX_HOST;
}

/** Absolute origin of the faucet as seen by this request. */
export function resolveTrxOrigin(request: Request): string {
  return `https://${resolveTrxHost(request)}`;
}
