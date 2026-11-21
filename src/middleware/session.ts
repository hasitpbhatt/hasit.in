import { signJWT, verifyJWT, type HasitJWTPayload } from '../lib/auth/jwt';
import type { Env } from '../env';

const CLAIM_SESSION_TTL = 30 * 60; // 30 minutes
const SESSION_COOKIE_NAME = 'claim_session';

/**
 * `Domain=.hasit.in` is required in production so the cookie is shared across
 * subdomains, but browsers reject it on localhost, so it is skipped locally.
 */
function cookieDomain(env?: Env): string {
  return env?.ENVIRONMENT === 'development' ? '' : '; Domain=.hasit.in';
}

interface ClaimSessionData {
  address: string;
  createdAt: number;
  csrf: string;
}

/**
 * A claim session is minted when the claim page is rendered and carries the
 * CSRF token that the POST must echo back.
 *
 * Note: the memory game is client side by design and proves nothing to the
 * server. The bot gates are Turnstile, the rate limit and the claim limits.
 */
export async function createClaimSession(env: Env, address: string): Promise<string> {
  const csrf = crypto.randomUUID();

  return signJWT(
    {
      sub: 'claim_session',
      email: '',
      name: '',
      picture: '',
      app: 'trx',
      scope: 'claim',
      address,
      csrf,
    },
    env,
    '30m'
  );
}

export async function readClaimSession(
  env: Env,
  token: string | undefined
): Promise<ClaimSessionData | null> {
  if (!token) return null;

  const payload = await verifyJWT(token, env);
  if (!payload || payload.sub !== 'claim_session') return null;

  const claims = payload as HasitJWTPayload;
  return {
    address: typeof claims.address === 'string' ? claims.address : '',
    createdAt: typeof claims.iat === 'number' ? claims.iat * 1000 : Date.now(),
    csrf: typeof claims.csrf === 'string' ? claims.csrf : '',
  };
}

export function clearClaimSession(env?: Env): string {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0${cookieDomain(env)}`;
}

export function setClaimSessionCookie(token: string, env?: Env): string {
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${CLAIM_SESSION_TTL}${cookieDomain(env)}`;
}

// Admin session
const ADMIN_SESSION_TTL = 8 * 60 * 60; // 8 hours
const ADMIN_COOKIE_NAME = 'admin_session';

export interface AdminSession {
  token: string;
  userId: number;
  csrf: string;
}

/** The token is already known by the caller on the read path. */
export interface AdminSessionData {
  userId: number;
  csrf: string;
}

export async function createAdminSession(env: Env, userId: number): Promise<AdminSession> {
  const csrf = crypto.randomUUID();

  const token = await signJWT(
    {
      sub: 'admin',
      email: '',
      name: '',
      picture: '',
      app: 'admin',
      scope: 'admin',
      userId,
      csrf,
    },
    env,
    '8h'
  );

  return { token, userId, csrf };
}

export async function readAdminSession(
  env: Env,
  token: string | undefined
): Promise<AdminSessionData | null> {
  if (!token) return null;

  const payload = await verifyJWT(token, env);
  if (!payload || payload.sub !== 'admin') return null;

  const claims = payload as HasitJWTPayload;
  return {
    userId: Number(claims.userId ?? 0),
    csrf: typeof claims.csrf === 'string' ? claims.csrf : '',
  };
}

export function clearAdminSession(env?: Env): string {
  return `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0${cookieDomain(env)}`;
}

export function setAdminSessionCookie(token: string, env?: Env): string {
  return `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${ADMIN_SESSION_TTL}${cookieDomain(env)}`;
}

// Flash messages (one-time notifications)
const FLASH_TTL = 60; // 1 minute
const FLASH_COOKIE_NAME = 'flash';

export function createFlashCookie(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
  env?: Env
): string {
  const data = btoa(JSON.stringify({ message, type }));
  return `${FLASH_COOKIE_NAME}=${data}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${FLASH_TTL}${cookieDomain(env)}`;
}

export function readFlashCookie(cookieHeader: string | null): { message: string; type: string } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${FLASH_COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(atob(match[1]));
  } catch {
    return null;
  }
}

export function clearFlashCookie(env?: Env): string {
  return `${FLASH_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0${cookieDomain(env)}`;
}

// CSRF protection
export function generateCSRF(): string {
  return crypto.randomUUID();
}

export function validateCSRF(sessionCSRF: string, formCSRF: string): boolean {
  return sessionCSRF === formCSRF && sessionCSRF.length > 0;
}
