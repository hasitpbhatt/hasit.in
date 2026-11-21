import type { Env } from '../../env';

export const SCOPES = {
  freellm: 'openid email profile',
  fitness: 'openid email profile https://www.googleapis.com/auth/fitness.activity.read',
  finance: 'openid email profile',
  quiz: 'openid email profile',
  blog: 'openid email profile',
  games: 'openid email profile',
  trx: 'openid email profile',
  default: 'openid email profile',
} as const;

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

export interface GoogleTokens {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  [key: string]: unknown;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

export function getRedirectUri(env: Env): string {
  return env.GOOGLE_REDIRECT_URI || 'https://auth.hasit.in/callback';
}

export function getAuthUrl(env: Env, app: string, state: string): string {
  const scope = SCOPES[app as keyof typeof SCOPES] || SCOPES.default;
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(env),
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  env: Env,
  code: string
): Promise<{ tokens: GoogleTokens; user: GoogleUser }> {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: getRedirectUri(env),
    grant_type: 'authorization_code',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed with status ${response.status}`);
  }

  const tokens = await response.json() as GoogleTokens;
  const user = await fetchGoogleUser(tokens.access_token);

  return { tokens, user };
}

export async function refreshAccessToken(env: Env, refreshToken: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed with status ${response.status}`);
  }

  return await response.json() as GoogleTokens;
}

export async function getUserFromAccessToken(accessToken: string): Promise<GoogleUser | null> {
  try {
    return await fetchGoogleUser(accessToken);
  } catch {
    return null;
  }
}

async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo request failed with status ${response.status}`);
  }

  const profile = await response.json() as GoogleUserInfo;
  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    email_verified: profile.email_verified,
  };
}
