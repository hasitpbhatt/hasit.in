#!/usr/bin/env node
// Guard against configuration drift.
//
// 1. Secrets must never live in wrangler.toml [vars].
// 2. public/ads.txt must advertise the publisher id from ADSENSE_CLIENT.
// 3. [assets] html_handling must be "none" so the SPA shell rewrite works.
//
// Run with: npm run check:config

import fs from 'fs';
import path from 'path';

const root = process.cwd();
const toml = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
const adsTxtPath = path.join(root, 'public', 'ads.txt');

const errors = [];

const varsSection = toml.match(/\[vars\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';

const FORBIDDEN_IN_VARS = [
  'GOOGLE_CLIENT_SECRET',
  'TURNSTILE_SECRET',
  'FAUCETPAY_API_KEY',
  'FAUCETPAY_USER_TOKEN',
  'JWT_PRIVATE_KEY',
  'JWT_PUBLIC_KEY',
];

for (const key of FORBIDDEN_IN_VARS) {
  if (new RegExp(`^\\s*${key}\\s*=`, 'm').test(varsSection)) {
    errors.push(`secret "${key}" must not be in [vars] - use: wrangler secret put ${key}`);
  }
}

const adsenseClient = toml.match(/^\s*ADSENSE_CLIENT\s*=\s*"([^"]*)"/m)?.[1]?.trim();

// 3. Asset handling must stay compatible with the Worker's SPA rewrite.
//
// The Worker serves app shells by fetching /_spa/<app>/index.html through the
// ASSETS binding. Any html_handling other than "none" turns that fetch into a
// 307 to the directory URL, which leaks the private /_spa/ prefix and breaks
// every SPA subdomain. See the comment in wrangler.toml.
const assetsSection = toml.match(/\[assets\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';

if (!assetsSection) {
  errors.push('[assets] section is missing from wrangler.toml');
} else {
  const htmlHandling = assetsSection.match(/^\s*html_handling\s*=\s*"([^"]*)"/m)?.[1];

  if (htmlHandling !== 'none') {
    errors.push(
      `[assets] html_handling must be "none" (found ${htmlHandling === undefined ? 'the default' : `"${htmlHandling}"`}): ` +
        'any other value makes ASSETS.fetch("/_spa/<app>/index.html") answer 307 instead of the SPA shell'
    );
  }

  const notFoundHandling = assetsSection.match(/^\s*not_found_handling\s*=\s*"([^"]*)"/m)?.[1];

  if (notFoundHandling === 'single-page-application') {
    errors.push(
      '[assets] not_found_handling must not be "single-page-application": ' +
        'asset misses must reach the Worker so it can pick the app for the hostname'
    );
  }
}

if (!adsenseClient) {
  errors.push('ADSENSE_CLIENT is missing from wrangler.toml [vars]');
} else if (!fs.existsSync(adsTxtPath)) {
  errors.push('public/ads.txt is missing');
} else {
  const publisherId = adsenseClient.replace(/^ca-/, '');
  const adsTxt = fs.readFileSync(adsTxtPath, 'utf8');
  if (!adsTxt.includes(publisherId)) {
    errors.push(
      `public/ads.txt does not advertise "${publisherId}" (ADSENSE_CLIENT=${adsenseClient})`
    );
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`✖ ${error}`);
  process.exit(1);
}

console.log('✔ config checks passed');
