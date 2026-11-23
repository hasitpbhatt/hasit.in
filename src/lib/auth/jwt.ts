import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import type { JWTPayload } from 'jose';
import type { Env } from '../../env';

// Cache imported keys
let privateKey: CryptoKey | null = null;
let publicKey: CryptoKey | null = null;

/**
 * Normalise a PEM key that may arrive with escaped newlines, without headers,
 * or as raw base64 (common when stored as a Cloudflare secret).
 */
function normalizePem(raw: string | undefined, kind: 'PRIVATE' | 'PUBLIC'): string {
  const value = (raw ?? '').replace(/\\n/g, '\n').trim();
  if (!value) {
    throw new Error(`JWT_${kind}_KEY is not configured`);
  }
  if (value.includes('-----BEGIN')) {
    return value;
  }
  const body = value.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g)?.join('\n') ?? body;
  return `-----BEGIN ${kind} KEY-----\n${lines}\n-----END ${kind} KEY-----`;
}

async function getPrivateKey(env: Env): Promise<CryptoKey> {
  if (!privateKey) {
    const imported = await importPKCS8(normalizePem(env.JWT_PRIVATE_KEY, 'PRIVATE'), 'ES256');
    privateKey = imported as unknown as CryptoKey;
  }
  return privateKey;
}

/** Decode a PKCS#8 PEM body into DER bytes for WebCrypto. */
function privateKeyDer(pem: string) {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    der[i] = binary.charCodeAt(i);
  }
  return der;
}

/**
 * Some deployments only receive JWT_PRIVATE_KEY. Derive the matching EC
 * verification key from it so issued tokens remain verifiable.
 */
async function derivePublicKey(env: Env): Promise<CryptoKey> {
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyDer(normalizePem(env.JWT_PRIVATE_KEY, 'PRIVATE')),
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign']
  );
  const jwk = (await crypto.subtle.exportKey('jwk', signingKey)) as JsonWebKey;
  delete jwk.d;
  jwk.key_ops = ['verify'];
  jwk.ext = true;
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify']
  );
}

async function getPublicKey(env: Env): Promise<CryptoKey> {
  if (!publicKey) {
    publicKey = env.JWT_PUBLIC_KEY
      ? (await importSPKI(normalizePem(env.JWT_PUBLIC_KEY, 'PUBLIC'), 'ES256')) as unknown as CryptoKey
      : await derivePublicKey(env);
  }
  return publicKey;
}

export interface HasitJWTPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  picture: string;
  app: string;
  scope: string;
  email_verified: boolean;
}

export async function signJWT(payload: Omit<HasitJWTPayload, 'iat' | 'exp'>, env: Env, expiresIn = '15m'): Promise<string> {
  const key = await getPrivateKey(env);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export async function verifyJWT(token: string, env: Env): Promise<HasitJWTPayload | null> {
  try {
    const key = await getPublicKey(env);
    const { payload } = await jwtVerify(token, key, { algorithms: ['ES256'] });
    return payload as unknown as HasitJWTPayload;
  } catch {
    return null;
  }
}

export async function signRefreshToken(payload: { sub: string; app: string }, env: Env): Promise<string> {
  const key = await getPrivateKey(env);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key);
}

export async function verifyRefreshToken(token: string, env: Env): Promise<{ sub: string; app: string } | null> {
  try {
    const key = await getPublicKey(env);
    const { payload } = await jwtVerify(token, key, { algorithms: ['ES256'] });
    return { sub: payload.sub as string, app: payload.app as string };
  } catch {
    return null;
  }
}