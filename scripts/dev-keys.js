#!/usr/bin/env node
// Generates an ES256 (P-256) key pair for JWT signing and writes it into .dev.vars
// for local development. For production, set the same values with:
//
//   wrangler secret put JWT_PRIVATE_KEY
//   wrangler secret put JWT_PUBLIC_KEY
//
// Run with: npm run dev:keys

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DEV_VARS = path.join(process.cwd(), '.dev.vars');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });

// Raw base64 bodies: single-line friendly for .dev.vars / wrangler secrets.
const strip = (pem) =>
  pem
    .toString()
    .replace(/-----(BEGIN|END) [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');

const priv = strip(privateKey.export({ type: 'pkcs8', format: 'pem' }));
const pub = strip(publicKey.export({ type: 'spki', format: 'pem' }));

const defaults = `# Local development secrets - NOT for production (gitignored)
ENVIRONMENT=development
FAUCETPAY_API_KEY=dev-dummy-faucetpay-key
# Cloudflare Turnstile always-pass test secret
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
GOOGLE_CLIENT_SECRET=dev-dummy-google-secret
`;

let content = fs.existsSync(DEV_VARS) ? fs.readFileSync(DEV_VARS, 'utf8') : defaults;

const setVar = (source, name, value) => {
  const lines = source.split(/\r?\n/);
  const output = [];
  let replaced = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith(`${name}=`)) {
      output.push(line);
      continue;
    }

    output.push(`${name}=${value}`);
    replaced = true;

    // A previously hand-edited PEM may spill onto continuation lines. They
    // carry no '=' and belong to the value we are replacing.
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!next.trim() || next.startsWith('#') || /^[A-Z][A-Z0-9_]*=/.test(next)) break;
      i += 1;
    }
  }

  if (!replaced) {
    while (output.length && !output[output.length - 1].trim()) output.pop();
    output.push(`${name}=${value}`);
  }

  return `${output.join('\n').replace(/\s*$/, '')}\n`;
};

content = setVar(content, 'JWT_PRIVATE_KEY', priv);
content = setVar(content, 'JWT_PUBLIC_KEY', pub);

fs.writeFileSync(DEV_VARS, content, 'utf8');
console.log('✅ Wrote fresh ES256 JWT key pair into .dev.vars');
console.log('   Restart `npm run dev` to pick it up.');
