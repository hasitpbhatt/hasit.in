#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
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

async function buildGames() {
  const appRoot = path.join(appsRoot, 'games');
  const output = await resetOutput('games');
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
}

async function buildFitness() {
  const appRoot = path.join(appsRoot, 'fitness');
  const output = await resetOutput('fitness');
  await installIfNeeded(appRoot);
  runNpm(appRoot, ['run', 'build']);
  await cp(path.join(appRoot, 'out'), output, { recursive: true });
}

async function copyFinance() {
  const source = path.join(appsRoot, 'finance', 'public');
  const output = await resetOutput('finance');
  await cp(source, output, { recursive: true });
}

async function copyQuiz() {
  const source = path.join(appsRoot, 'quiz', 'quiz');
  const output = await resetOutput('quiz');
  await cp(source, output, {
    recursive: true,
    filter: (entry) => !/(^|[\\/])(tests|scripts|proxy)([\\/]|$)/.test(entry),
  });
}

function generateSitemap() {
  const BASE_URL = 'https://hasit.in';
  const SUBDOMAINS = [
    { subdomain: 'www', paths: ['/'] },
    { subdomain: 'trx', paths: ['/', '/claim', '/admin', '/p'] },
    { subdomain: 'trx2', paths: ['/', '/claim', '/admin', '/p'] },
    { subdomain: 'freellm', paths: ['/', '/chat', '/keys', '/models', '/settings'] },
    { subdomain: 'fitness', paths: ['/', '/workouts', '/food', '/progress', '/quiz', '/today', '/login'] },
    { subdomain: 'finance', paths: ['/', '/s'] },
    { subdomain: 'quiz', paths: ['/'] },
    { subdomain: 'games', paths: ['/'] },
    { subdomain: 'auth', paths: ['/', '/login', '/callback'] },
    { subdomain: '', paths: ['/'] },
  ];

  const urls = [];
  urls.push(`${BASE_URL}/`);

  for (const sub of SUBDOMAINS) {
    const subdomainUrl = sub.subdomain ? `https://${sub.subdomain}.hasit.in` : BASE_URL;
    for (const p of sub.paths) {
      urls.push(`${subdomainUrl}${p}`);
    }
  }

  const now = new Date().toISOString().split('T')[0];

  const urlEntries = urls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url === BASE_URL + '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`;
}

async function buildApps() {
  await mkdir(outputRoot, { recursive: true });
  await buildFreeLlm();
  await buildGames();
  await buildFitness();
  await copyFinance();
  await copyQuiz();

  // Generate sitemap.xml
  const sitemap = generateSitemap();
  await writeFile(path.join(publicDir, 'sitemap.xml'), sitemap);
  console.log('Sitemap generated at public/sitemap.xml');
}

buildApps().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
