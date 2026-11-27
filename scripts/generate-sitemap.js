#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

const BASE_URL = 'https://hasit.in';

/** Known subdomains and their paths */
const SUBDOMAINS = [
  { subdomain: 'www', name: 'www' },
  { subdomain: 'trx', name: 'TRX Faucet', paths: ['/', '/claim', '/admin', '/p'] },
  { subdomain: 'trx2', name: 'TRX Faucet v2', paths: ['/', '/claim', '/admin', '/p'] },
  { subdomain: 'freellm', name: 'FreeLLM', paths: ['/', '/chat', '/keys', '/models', '/settings'] },
  { subdomain: 'auth', name: 'Auth', paths: ['/', '/login', '/callback'] },
  { subdomain: '', name: 'Portfolio', paths: ['/'] },
];

function generateSitemap() {
  const urls = [];

  // Main domain
  urls.push(`${BASE_URL}/`);

  // Subdomains
  for (const sub of SUBDOMAINS) {
    const subdomainUrl = sub.subdomain ? `https://${sub.subdomain}.hasit.in` : BASE_URL;

    // Add root of subdomain
    urls.push(`${subdomainUrl}/`);

    // Add known paths for each subdomain
    if (sub.paths) {
      for (const p of sub.paths) {
        if (p !== '/') {
          urls.push(`${subdomainUrl}${p}`);
        }
      }
    }
  }

  // Add static files from public directory
  // Note: We can't easily do async here, so we'll generate a basic sitemap
  // and the static files will be discovered by crawlers

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
</urlset>
`;
}

async function main() {
  const sitemap = generateSitemap();
  const outputPath = path.join(publicDir, 'sitemap.xml');
  await writeFile(outputPath, sitemap);
  console.log(`Sitemap generated at ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});