import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { trx } from '../../../lib/db/trx-queries';
import { escapeHtml } from '../../../lib/html';
import { THEME_BOOTSTRAP, THEME_RUNTIME, renderThemeToggle } from '../../../lib/theme';
import type { Env } from '../../../env';

export const userPageRoutes = new Hono<{ Bindings: Env }>();

userPageRoutes.use('*', cors({
  origin: ['https://trx.hasit.in', 'https://trx2.hasit.in'],
  credentials: true,
}));

// GET /p/:slug - Render custom page
userPageRoutes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');

  const page = await trx.pages.getByUrlName(c.env.DB, slug);

  if (!page) {
    return c.notFound();
  }

  // The page body is admin-authored HTML and is served raw on purpose.
  const html = renderUserPage({
    title: String(page.name ?? ''),
    content: String(page.html ?? ''),
  });

  return c.html(html);
});

function renderUserPage(data: { title: string; content: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${THEME_BOOTSTRAP}
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.title)} - TRX Faucet</title>
  <link rel="stylesheet" href="//cdn.jsdelivr.net/bootstrap/3.3.4/css/bootstrap.min.css">
  <link rel="stylesheet" href="/theme.css">
  <style>
    body { font-family: var(--font-ui); background: var(--bg); color: var(--text-primary); min-height: 100vh; }
    .navbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 0; margin-bottom: 0; }
    .navbar .container { display: flex; align-items: center; gap: 1rem; }
    .navbar-brand { color: var(--text-primary); font-weight: 600; padding: 0; height: auto; }
    .navbar-brand:hover, .navbar-brand:focus { color: var(--accent); }
    .container { max-width: 800px; padding-top: 2rem; padding-bottom: 3rem; }
    .page-content { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-ui); padding: 2rem; }
    .page-title { font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; color: var(--text-primary); }
    .back-link { display: inline-block; margin-bottom: 1.5rem; color: var(--accent); text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="container">
      <a class="navbar-brand" href="/">TRX Faucet</a>
      ${renderThemeToggle()}
    </div>
  </nav>

  <div class="container">
    <a href="/" class="back-link">← Back to Faucet</a>
    <div class="page-content">
      <h1 class="page-title">${escapeHtml(data.title)}</h1>
      <div>${data.content}</div>
    </div>
  </div>
  ${THEME_RUNTIME}
</body>
</html>`;
}
