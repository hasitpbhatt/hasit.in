import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { trx } from '../../../lib/db/trx-queries';
import { escapeHtml } from '../../../lib/html';
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
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.title)} - TRX Faucet</title>
  <link rel="stylesheet" href="//cdn.jsdelivr.net/bootstrap/3.3.4/css/bootstrap.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #f4f2ec; min-height: 100vh; }
    .navbar { background: white; border-bottom: 1px solid #e6e2d8; padding: 1rem 0; }
    .container { max-width: 800px; padding-top: 2rem; padding-bottom: 3rem; }
    .page-content { background: white; border: 1px solid #e6e2d8; border-radius: 8px; padding: 2rem; }
    .page-title { font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; color: #1F1E1A; }
    .back-link { display: inline-block; margin-bottom: 1.5rem; color: #5B5BD6; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="container">
      <a class="navbar-brand" href="/">TRX Faucet</a>
    </div>
  </nav>

  <div class="container">
    <a href="/" class="back-link">← Back to Faucet</a>
    <div class="page-content">
      <h1 class="page-title">${escapeHtml(data.title)}</h1>
      <div>${data.content}</div>
    </div>
  </div>
</body>
</html>`;
}
