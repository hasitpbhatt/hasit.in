import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { SignJWT, importPKCS8 } from 'jose';

import { signJWT, verifyJWT } from '../src/lib/auth/jwt.ts';
import type { Env } from '../src/env';

function keyPair() {
  const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const strip = (pem: string) =>
    pem.replace(/-----(BEGIN|END) [A-Z ]+-----/g, '').replace(/\s+/g, '');
  return { privatePem, privateBase64: strip(privatePem) };
}

function envWithPrivateKeyOnly(privateBase64: string): Env {
  // Mirrors the deployed Worker: the private key exists, the public one does not.
  return { JWT_PRIVATE_KEY: privateBase64, JWT_PUBLIC_KEY: '' } as Env;
}

const payload = {
  sub: 'claim_session',
  email: '',
  name: '',
  picture: '',
  app: 'trx',
  scope: 'claim',
  address: '',
  csrf: 'unit-test-csrf',
};

test('verification derives the public key when JWT_PUBLIC_KEY is missing', async () => {
  const keys = keyPair();
  const env = envWithPrivateKeyOnly(keys.privateBase64);

  const token = await signJWT(payload, env, '5m');
  const verified = await verifyJWT(token, env);

  assert.equal(verified?.sub, 'claim_session');
  assert.equal(verified?.csrf, 'unit-test-csrf');
});

test('a token signed by another key is rejected by the derived verifier', async () => {
  const env = envWithPrivateKeyOnly(keyPair().privateBase64);
  const foreignKey = await importPKCS8(keyPair().privatePem, 'ES256');
  const foreignToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(foreignKey);

  assert.equal(await verifyJWT(foreignToken, env), null);
});
