#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = path.join(root, 'apps');
const outputRoot = path.join(root, 'public', '_spa');
const publicDir = path.join(root, 'public');

function runNpm(cwd, args) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(' ')} failed in ${path.relative(root, cwd)}`);
  }
}

async function installIfNeeded(appRoot) {
  if (!await exists(path.join(appRoot, 'node_modules'))) {
    runNpm(appRoot, ['ci']);
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function resetOutput(appName) {
  const output = path.join(outputRoot, appName);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  return output;
}

/**
 * The shared design-token layer lives at /theme.css and /theme.js, outside any
 * app's build. SPA hosts resolve asset URLs through SPA_ASSET_ROOTS first, so a
 * copy must exist under the staged output or every page load eats a 404 hop
 * before falling back to the root asset.
 */
async function copySharedTheme(output) {
  for (const file of ['theme.css', 'theme.js']) {
    await copyFile(path.join(publicDir, file), path.join(output, file));
  }
}

async function buildFreeLlm() {
  const appRoot = path.join(appsRoot, 'freellm');
  const output = await resetOutput('freellm');
  await installIfNeeded(appRoot);
  runNpm(appRoot, ['run', 'typecheck']);
  runNpm(appRoot, [
    'exec',
    '--',
    'vite',
    'build',
    '--base',
    '/',
    '--outDir',
    path.relative(appRoot, output),
    '--emptyOutDir',
  ]);
  await copySharedTheme(output);
}

function generateSitemap() {
  const BASE_URL = 'https://hasit.in';

  // Only list URLs that actually resolve. Notably absent:
  //  - www: duplicate of the canonical root
  //  - trx: legacy static faucet, serves / only and 404s on every app route
  //  - auth: API-only broker, no browsable pages
  //  - trx2 /claim and /p: the claim form lives at /, and /p requires a slug
  const SUBDOMAINS = [
    { subdomain: '', paths: ['/'], priority: '1.0' },
    { subdomain: 'trx2', paths: ['/'] },
    { subdomain: 'freellm', paths: ['/', '/chat', '/keys', '/models', '/settings'] },
    { subdomain: 'fitness', paths: ['/'] },
    { subdomain: 'quizify', paths: ['/'] },
    { subdomain: 'blog', paths: ['/'] },
  ];

  const urls = [];
  const priorities = new Map();

  for (const sub of SUBDOMAINS) {
    const subdomainUrl = sub.subdomain ? `https://${sub.subdomain}.hasit.in` : BASE_URL;
    for (const p of sub.paths) {
      const url = `${subdomainUrl}${p}`;
      urls.push(url);
      priorities.set(url, sub.priority ?? '0.8');
    }
  }

  const now = new Date().toISOString().split('T')[0];

  const urlEntries = urls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priorities.get(url)}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>
`;
}

async function buildApps() {
  await mkdir(outputRoot, { recursive: true });
  await buildFreeLlm();

  // Generate sitemap.xml
  const sitemap = generateSitemap();
  await writeFile(path.join(publicDir, 'sitemap.xml'), sitemap);
  console.log('Sitemap generated at public/sitemap.xml');
}

buildApps().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
