#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsRoot = path.join(root, 'apps');
const outputRoot = path.join(root, 'public', 'apps');

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
    '/apps/games/',
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
    '/apps/freellm/',
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
  await rewriteFinanceAssets(output);
}

async function rewriteFinanceAssets(output) {
  const files = await readdir(output, { recursive: true, withFileTypes: true });
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const filePath = path.join(entry.parentPath, entry.name);
    if (entry.name.endsWith('.html')) {
      const html = await readFile(filePath, 'utf8');
      const rewritten = html.replace(
        /(src|href)=(["'])\/(?!\/)([^"']*)\2/gi,
        (match, attribute, quote, assetPath) => {
          if (assetPath === 'api' || assetPath.startsWith('api/')) return match;
          return `${attribute}=${quote}/apps/finance/${assetPath}${quote}`;
        }
      );
      await writeFile(filePath, rewritten);
    } else if (entry.name.endsWith('.css')) {
      const css = await readFile(filePath, 'utf8');
      const rewritten = css.replace(
        /url\((\s*)(["']?)\/(?!\/|apps\/finance\/)([^)"']+)\2(\s*)\)/g,
        'url($1$2/apps/finance/$3$2$4)'
      );
      await writeFile(filePath, rewritten);
    }
  }
}

async function copyQuiz() {
  const source = path.join(appsRoot, 'quiz', 'quiz');
  const output = await resetOutput('quiz');
  await cp(source, output, {
    recursive: true,
    filter: (entry) => !/(^|[\\/])(tests|scripts|proxy)([\\/]|$)/.test(entry),
  });
}

async function buildApps() {
  await mkdir(outputRoot, { recursive: true });
  await buildFreeLlm();
  await buildGames();
  await buildFitness();
  await copyFinance();
  await copyQuiz();
}

buildApps().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
