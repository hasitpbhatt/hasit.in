import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAuthUrl } from './google';
import { verifyJWT, verifyRefreshToken, signJWT, signRefreshToken } from './jwt';
import {
  handleOAuthCallback,
  getRefreshToken,
  revokeUserApp,
  revokeAllUserSessions,
  encryptRefreshToken,
} from './db';
import type { Env } from '../../env';

export const authRoutes = new Hono<{ Bindings: Env }>();

const VALID_APPS = ['freellm', 'fitness', 'blog', 'trx', 'quizify'] as const;
type ValidApp = typeof VALID_APPS[number];

const AUTH_STATE_OBJECT = 'oauth-state';
const AUTH_STATE_TTL_MS = 600_000;

interface OAuthState {
  app: ValidApp;
  returnUrl: string;
}

interface StoredExchange {
  accessToken: string;
  sessionId: string;
}

interface UserRow {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

/** Read a cookie value out of the raw Cookie header. */
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isValidApp(app: string): app is ValidApp {
  return (VALID_APPS as readonly string[]).includes(app);
}

/** Only app subdomains may be used as a post-login redirect target. */
const ALLOWED_ORIGINS = new Set([
  'https://hasit.in',
  'https://www.hasit.in',
  'https://auth.hasit.in',
  'https://trx2.hasit.in',
  ...VALID_APPS.map((app) => `https://${app}.hasit.in`),
]);

function trustedReturnUrl(value: string | undefined, app: ValidApp): string {
  const fallback = `https://${app}.hasit.in`;
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !ALLOWED_ORIGINS.has(url.origin)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function authStateStub(env: Env): DurableObjectStub {
  return env.AUTH_STATE.get(env.AUTH_STATE.idFromName(AUTH_STATE_OBJECT));
}

function authStateUrl(key: string, consume = false): string {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://auth-state.internal/${encodedKey}`);
  if (consume) url.searchParams.set('consume', '1');
  return url.toString();
}

async function putAuthState(env: Env, key: string, value: string, expiresAt: number): Promise<void> {
  const response = await authStateStub(env).fetch(authStateUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, expiresAt }),
  });

  if (!response.ok) {
    throw new Error(`Auth state storage failed with status ${response.status}`);
  }
}

async function getAuthStateValue(env: Env, key: string, consume: boolean): Promise<string | null> {
  try {
    const response = await authStateStub(env).fetch(authStateUrl(key, consume));
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isRecord(body) || body.found !== true || typeof body.value !== 'string') {
      return null;
    }
    return body.value;
  } catch {
    return null;
  }
}

function parseOAuthState(value: string): OAuthState | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || typeof parsed.app !== 'string' || !isValidApp(parsed.app) || typeof parsed.returnUrl !== 'string') {
      return null;
    }
    return { app: parsed.app, returnUrl: parsed.returnUrl };
  } catch {
    return null;
  }
}

function parseExchange(value: string): StoredExchange | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || typeof parsed.accessToken !== 'string' || typeof parsed.sessionId !== 'string') {
      return null;
    }
    return { accessToken: parsed.accessToken, sessionId: parsed.sessionId };
  } catch {
    return null;
  }
}

function refreshCookie(env: Env, name: string, value: string, maxAge: number): string {
  const domain = env.ENVIRONMENT !== 'development' ? '; Domain=.hasit.in' : '';
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}${domain}`;
}

function callbackRedirect(returnUrl: string, code: string, sessionId: string): string {
  const separator = returnUrl.includes('?') ? '&' : '?';
  return `${returnUrl}${separator}code=${encodeURIComponent(code)}&session=${encodeURIComponent(sessionId)}`;
}

// CORS for auth subdomain
authRoutes.use('*', cors({
  origin: (origin) => (ALLOWED_ORIGINS.has(origin) ? origin : null),
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

// Initiate OAuth flow
authRoutes.get('/login/:app', async (c) => {
  const app = c.req.param('app');
  if (!isValidApp(app)) {
    return c.json({ error: 'Invalid app' }, 400);
  }

  const returnUrl = trustedReturnUrl(c.req.query('return'), app);
  const state = crypto.randomUUID();

  try {
    await putAuthState(
      c.env,
      `oauth/${state}`,
      JSON.stringify({ app, returnUrl }),
      Date.now() + AUTH_STATE_TTL_MS
    );
  } catch (err) {
    console.error('OAuth state storage error:', err);
    return c.json({ error: 'Unable to start authentication' }, 500);
  }

  return c.redirect(getAuthUrl(c.env, app, state));
});

// Google OAuth callback
authRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`https://hasit.in?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.json({ error: 'Missing code or state' }, 400);
  }

  const storedState = await getAuthStateValue(c.env, `oauth/${state}`, true);
  if (!storedState) {
    return c.json({ error: 'Invalid or expired state' }, 400);
  }

  const oauthState = parseOAuthState(storedState);
  if (!oauthState) {
    return c.json({ error: 'Invalid or expired state' }, 400);
  }

  try {
    const { accessToken, refreshToken, sessionId } = await handleOAuthCallback(
      c.env,
      code,
      oauthState.app
    );
    const exchangeCode = crypto.randomUUID();

    await putAuthState(
      c.env,
      `exchange/${exchangeCode}`,
      JSON.stringify({ accessToken, sessionId }),
      Date.now() + AUTH_STATE_TTL_MS
    );

    const headers = new Headers();
    headers.set(
      'Set-Cookie',
      refreshCookie(c.env, `refresh_${oauthState.app}`, refreshToken, 2_592_000)
    );
    headers.set('Location', callbackRedirect(oauthState.returnUrl, exchangeCode, sessionId));

    return new Response(null, { status: 302, headers });
  } catch (err) {
    console.error('OAuth callback error:', err);
    return c.redirect('https://hasit.in?error=auth_failed');
  }
});

// Exchange a one-time callback code for the access token
authRoutes.post('/exchange', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = null;
  }

  if (!isRecord(body) || typeof body.code !== 'string' || !body.code) {
    return c.json({ error: 'Invalid or expired code' }, 401);
  }

  const storedExchange = await getAuthStateValue(c.env, `exchange/${body.code}`, true);
  if (!storedExchange) {
    return c.json({ error: 'Invalid or expired code' }, 401);
  }

  const exchange = parseExchange(storedExchange);
  if (!exchange) {
    return c.json({ error: 'Invalid or expired code' }, 401);
  }

  return c.json({ accessToken: exchange.accessToken, sessionId: exchange.sessionId });
});

// Token refresh endpoint (called by apps)
authRoutes.post('/refresh/:app', async (c) => {
  const app = c.req.param('app');
  const cookieName = `refresh_${app}`;
  const refreshToken = readCookie(c.req.header('Cookie'), cookieName);

  if (!refreshToken) {
    return c.json({ error: 'No refresh token' }, 401);
  }

  try {
    const payload = await verifyRefreshToken(refreshToken, c.env);
    if (!payload || payload.app !== app) {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }

    const user = await c.env.DB.prepare('SELECT id FROM core_users WHERE sub = ?').bind(payload.sub).first();
    if (!user) {
      return c.json({ error: 'User not found' }, 401);
    }

    const storedToken = await getRefreshToken(c.env.DB, c.env, user.id as number, app);
    if (!storedToken || storedToken !== refreshToken) {
      return c.json({ error: 'Token revoked' }, 401);
    }

    const userInfo = await c.env.DB.prepare(
      'SELECT sub, email, name, picture FROM core_users WHERE id = ?'
    ).bind(user.id).first<{ sub: string; email: string; name: string; picture: string }>();
    if (!userInfo) {
      throw new Error('User not found');
    }

    const accessToken = await signJWT({
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      app,
      scope: 'openid email profile',
      // Accounts only exist via Google OAuth, which verifies the address itself.
      email_verified: true,
    }, c.env, '15m');

    const newRefreshToken = await signRefreshToken({ sub: payload.sub, app }, c.env);
    const encrypted = await encryptRefreshToken(newRefreshToken, c.env);
    await c.env.DB.prepare('UPDATE core_user_apps SET refresh_token = ? WHERE user_id = ? AND app = ?')
      .bind(encrypted, user.id, app).run();

    const headers: Record<string, string> = {
      'Set-Cookie': refreshCookie(c.env, cookieName, newRefreshToken, 2_592_000),
    };

    return c.json({ accessToken }, 200, headers);
  } catch (err) {
    console.error('Token refresh error:', err);
    return c.json({ error: 'Refresh failed' }, 401);
  }
});

// Revoke app access (disconnect)
authRoutes.post('/revoke/:app', async (c) => {
  const app = c.req.param('app');
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'No access token' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, c.env);
  if (!payload || payload.app !== app) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  const user = await c.env.DB.prepare('SELECT id FROM core_users WHERE sub = ?').bind(payload.sub).first();
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  await revokeUserApp(c.env.DB, user.id as number, app);
  await revokeAllUserSessions(c.env.DB, user.id as number, app);

  const headers: Record<string, string> = {
    'Set-Cookie': refreshCookie(c.env, `refresh_${app}`, '', 0),
  };

  return c.json({ success: true }, 200, headers);
});

// Get current user info (for app initialization)
authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'No access token' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, c.env);

  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  return c.json({
    user: {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    },
    app: payload.app,
    scope: payload.scope,
  });
});

// Health check
authRoutes.get('/health', (c) => c.json({ status: 'ok', service: 'auth' }));
