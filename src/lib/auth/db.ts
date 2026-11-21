import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../env';
import { signJWT, signRefreshToken } from './jwt';
import { exchangeCodeForTokens, SCOPES, type GoogleUser } from './google';

// Simple encryption for refresh tokens at rest
const ENCRYPTION_ALGO = 'AES-GCM';
const IV_LENGTH = 12;

interface CoreUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

async function getCryptoKey(env: Env): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.JWT_PRIVATE_KEY.slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('hasit-refresh-token'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ENCRYPTION_ALGO, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptRefreshToken(token: string, env: Env): Promise<string> {
  const key = await getCryptoKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGO, iv },
    key,
    new TextEncoder().encode(token)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptRefreshToken(encryptedB64: string, env: Env): Promise<string> {
  const key = await getCryptoKey(env);
  const combined = new Uint8Array(atob(encryptedB64).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, IV_LENGTH);
  const encrypted = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGO, iv },
    key,
    encrypted
  );
  return new TextDecoder().decode(decrypted);
}

// Password hashing (PBKDF2-SHA256, stored as "pbkdf2$<iter>$<salt>$<hash>").
// Note: Workers' crypto.subtle does not support MD5, so the legacy PHP-style
// md5 hashes cannot be verified here; store a new password to migrate.
const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function pbkdf2(password: string, salt: BufferSource, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(bits);
}

/** Hash a password for storage. */
export async function setNewPass(password: string): Promise<string> {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  const saltHex = toHex(salt.buffer as ArrayBuffer);  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hash}`;
}

/** Constant-time string comparison for plaintext secrets. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Verify a password against a stored hash produced by setNewPass(). */
export async function verifyPass(password: string, stored: string): Promise<boolean> {
  if (!password || !stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false; // unsupported / legacy hash

  const iterations = parseInt(parts[1], 10);
  const salt = new Uint8Array(parts[2].match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  if (!iterations || salt.length === 0) return false;

  const candidate = await pbkdf2(password, salt, iterations);
  // Constant-time-ish comparison
  if (candidate.length !== parts[3].length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ parts[3].charCodeAt(i);
  }
  return diff === 0;
}

// Core user operations
export async function findUserBySub(db: D1Database, sub: string) {
  return db.prepare('SELECT * FROM core_users WHERE sub = ?').bind(sub).first();
}

export async function createUser(db: D1Database, user: GoogleUser) {
  const result = await db.prepare(
    'INSERT INTO core_users (sub, email, name, picture) VALUES (?, ?, ?, ?) RETURNING id'
  ).bind(user.sub, user.email, user.name, user.picture).run();
  return result.meta.last_row_id as number;
}

export async function updateUser(db: D1Database, sub: string, data: Partial<GoogleUser>) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
  const values = Object.values(data);
  values.push(sub);
  return db.prepare(`UPDATE core_users SET ${fields}, updated_at = unixepoch() WHERE sub = ?`).bind(...values).run();
}

// User app linking
export async function linkUserApp(db: D1Database, env: Env, userId: number, app: string, refreshToken: string, scope: string) {
  const encrypted = await encryptRefreshToken(refreshToken, env);
  return db.prepare(`
    INSERT OR REPLACE INTO core_user_apps (user_id, app, refresh_token, scope, connected_at)
    VALUES (?, ?, ?, ?, unixepoch())
  `).bind(userId, app, encrypted, scope).run();
}

export async function getUserApps(db: D1Database, env: Env, userId: number) {
  const results = await db.prepare('SELECT app, scope, connected_at, revoked_at FROM core_user_apps WHERE user_id = ?').bind(userId).all();
  return results.results.map(r => ({
    app: r.app as string,
    scope: r.scope as string,
    connectedAt: r.connected_at as number,
    revokedAt: r.revoked_at as number | null,
  }));
}

export async function revokeUserApp(db: D1Database, userId: number, app: string) {
  return db.prepare('UPDATE core_user_apps SET revoked_at = unixepoch() WHERE user_id = ? AND app = ?').bind(userId, app).run();
}

export async function getRefreshToken(db: D1Database, env: Env, userId: number, app: string): Promise<string | null> {
  const result = await db.prepare('SELECT refresh_token FROM core_user_apps WHERE user_id = ? AND app = ? AND revoked_at IS NULL')
    .bind(userId, app).first();
  if (!result?.refresh_token) return null;
  return decryptRefreshToken(result.refresh_token as string, env);
}

// Session management
export async function createSession(db: D1Database, env: Env, userId: number, app: string, scope: string): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const sessionId = crypto.randomUUID();
  const user = await db.prepare('SELECT sub, email, name, picture FROM core_users WHERE id = ?').bind(userId).first<CoreUser>();
  if (!user) {
    throw new Error('User not found');
  }
  
  const accessToken = await signJWT({
    sub: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    app,
    scope,
  }, env, '15m');

  const refreshToken = await signRefreshToken({ sub: user.sub, app }, env);
  
  await db.prepare(`
    INSERT INTO core_sessions (id, user_id, app, issued_at, expires_at)
    VALUES (?, ?, ?, unixepoch(), unixepoch() + 15 * 60)
  `).bind(sessionId, userId, app).run();

  return { accessToken, refreshToken, sessionId };
}

export async function revokeSession(db: D1Database, sessionId: string) {
  return db.prepare('UPDATE core_sessions SET revoked_at = unixepoch() WHERE id = ?').bind(sessionId).run();
}

export async function revokeAllUserSessions(db: D1Database, userId: number, app?: string) {
  if (app) {
    return db.prepare('UPDATE core_sessions SET revoked_at = unixepoch() WHERE user_id = ? AND app = ?').bind(userId, app).run();
  }
  return db.prepare('UPDATE core_sessions SET revoked_at = unixepoch() WHERE user_id = ?').bind(userId).run();
}

// Complete OAuth flow handler
export async function handleOAuthCallback(env: Env, code: string, app: string): Promise<{ app: string; accessToken: string; refreshToken: string; sessionId: string }> {
  const { tokens, user } = await exchangeCodeForTokens(env, code);

  // Find or create user
  const dbUser = await findUserBySub(env.DB, user.sub);
  let userId: number;
  if (dbUser) {
    userId = dbUser.id as number;
    await updateUser(env.DB, user.sub, { name: user.name, picture: user.picture });
  } else {
    userId = await createUser(env.DB, user);
  }

  // Link app
  await linkUserApp(env.DB, env, userId, app, tokens.refresh_token!, SCOPES[app as keyof typeof SCOPES] || SCOPES.default);

  // Create session
  const session = await createSession(env.DB, env, userId, app, SCOPES[app as keyof typeof SCOPES] || SCOPES.default);

  return { app, ...session };
}