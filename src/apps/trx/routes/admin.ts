import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { trx, toSettingsMap } from '../../../lib/db/trx-queries';
import { faucetpay } from '../../../lib/faucetpay';
import {
  createAdminSession,
  readAdminSession,
  setAdminSessionCookie,
  clearAdminSession,
  createFlashCookie,
  clearFlashCookie,
  readFlashCookie,
} from '../../../middleware/session';
import { setNewPass, verifyPass, safeEqual } from '../../../lib/auth/db';
import { escapeHtml } from '../../../lib/html';
import { THEME_BOOTSTRAP, THEME_RUNTIME, renderThemeToggle } from '../../../lib/theme';
import { strictRateLimitMiddleware } from '../../../middleware/rate-limit';
import type { Env } from '../../../env';

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.use('*', cors({
  origin: ['https://trx.hasit.in', 'https://trx2.hasit.in'],
  credentials: true,
}));

/**
 * Admin authentication. Runs before every admin route except the login form.
 *
 * The CSRF token travels with the session, so a form rendered for one session
 * cannot be replayed against another.
 */
async function adminAuth(c: any, next: any) {
  if (c.req.path.endsWith('/login')) {
    return next();
  }

  const cookieHeader = c.req.header('Cookie') || '';
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  const token = match ? match[1] : null;

  const session = await readAdminSession(c.env, token);
  if (!session) {
    return c.redirect('/admin/login');
  }

  c.set('adminUserId', session.userId);
  c.set('adminCsrf', session.csrf);

  await next();
}

function isValidAdminCsrf(c: any, formData: FormData): boolean {
  const expected = c.get('adminCsrf') as string | undefined;
  const token = formData.get('csrf');
  return Boolean(expected) && typeof token === 'string' && token === expected;
}

adminRoutes.use('/*', adminAuth);

// Login page
adminRoutes.get('/login', (c) => {
  return c.html(renderAdminLogin());
});

adminRoutes.post('/login', strictRateLimitMiddleware('admin', 5, 60_000), async (c) => {
  const formData = await c.req.formData();
  const password = (formData.get('password') as string) || '';

  const settings = await trx.settings.getAll(c.env.DB);
  const settingsMap = toSettingsMap(settings.results ?? []);
  const storedHash = settingsMap.get('password');

  let valid: boolean;

  if (storedHash) {
    valid = await verifyPass(password, storedHash);
  } else {
    // First run on a fresh database: the admin password must come from the
    // ADMIN_PASSWORD secret. Otherwise whoever posts first would own the panel.
    const bootstrap = c.env.ADMIN_PASSWORD;
    if (!bootstrap) {
      return c.json({ error: 'Admin password is not configured' }, 503);
    }
    valid = safeEqual(password, bootstrap);
    if (valid) {
      await trx.settings.set(c.env.DB, 'password', await setNewPass(password));
    }
  }

  if (valid) {
    const session = await createAdminSession(c.env, 1);
    return c.body(null, 302, {
      Location: '/admin',
      'Set-Cookie': setAdminSessionCookie(session.token, c.env),
    });
  }

  return c.body(null, 302, {
    Location: '/admin/login',
    'Set-Cookie': createFlashCookie('Invalid password', 'error', c.env),
  });
});

adminRoutes.get('/logout', (c) => {
  return c.body(null, 302, {
    Location: '/admin/login',
    'Set-Cookie': clearAdminSession(c.env),
  });
});

// Dashboard
adminRoutes.get('/', async (c) => {
  const settings = await trx.settings.getAll(c.env.DB);
  const settingsMap = toSettingsMap(settings.results ?? []);

  const recentClaims = await trx.claimlog.recent(c.env.DB, 20);
  const balance = settingsMap.get('balance') || 'N/A';
  const totalClaims = await c.env.DB.prepare('SELECT COUNT(*) as count FROM trx_claimlog WHERE address != \'\'').first();
  const totalUsers = await c.env.DB.prepare('SELECT COUNT(DISTINCT address) as count FROM trx_claimlog WHERE address != \'\'').first();
  const totalPaid = await c.env.DB.prepare('SELECT SUM(reward) as total FROM trx_claimlog WHERE address != \'\'').first();

  const flash = readFlashCookie(c.req.header('Cookie') ?? null);

  const html = renderAdminDashboard({
    balance,
    totalClaims: Number(totalClaims?.count ?? 0),
    totalUsers: Number(totalUsers?.count ?? 0),
    totalPaid: Number(totalPaid?.total ?? 0),
    recentClaims: recentClaims.results.map((row) => ({
      time: Number(row.time ?? 0),
      address: String(row.address ?? ''),
      reward: Number(row.reward ?? 0),
      ip: String(row.ip ?? ''),
    })),
    csrf: c.get('adminCsrf') ?? '',
    flash,
  });

  const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
  if (flash) headers.append('Set-Cookie', clearFlashCookie(c.env));

  return new Response(html, { headers });
});

// Settings
adminRoutes.get('/settings', async (c) => {
  const settings = await trx.settings.getAll(c.env.DB);
  const settingsMap = toSettingsMap(settings.results ?? []);

  const html = renderAdminSettings(settingsMap, c.get('adminCsrf') ?? '');
  return c.html(html);
});

adminRoutes.post('/settings', async (c) => {
  const formData = await c.req.formData();

  if (!isValidAdminCsrf(c, formData)) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  for (const [key, value] of formData.entries()) {
    if (key === 'csrf' || key === 'password') continue;
    const str = typeof value === 'string' ? value : '';
    await trx.settings.set(c.env.DB, key, str);
  }

  // Test FaucetPay connection if an API key was provided.
  const apikey = formData.get('apikey');
  if (typeof apikey === 'string' && apikey) {
    const balance = await faucetpay.getBalance(c.env);
    if (balance) {
      await trx.settings.set(c.env.DB, 'balance', balance.balance);
    }
  }

  return c.body(null, 302, {
    Location: '/admin/settings',
    'Set-Cookie': createFlashCookie('Settings saved successfully', 'success', c.env),
  });
});

// Send coins tool
adminRoutes.post('/send', async (c) => {
  const formData = await c.req.formData();

  if (!isValidAdminCsrf(c, formData)) {
    return c.json({ error: 'Invalid CSRF token' }, 403);
  }

  const address = (formData.get('address') as string) || '';
  const amount = parseFloat((formData.get('amount') as string) || '0');

  if (!address || !amount) {
    return c.body(null, 302, {
      Location: '/admin',
      'Set-Cookie': createFlashCookie('Invalid address or amount', 'error', c.env),
    });
  }

  const result = await faucetpay.sendCoins(c.env, address, Math.floor(amount * 1_000_000), '127.0.0.1');

  return c.body(null, 302, {
    Location: '/admin',
    'Set-Cookie': createFlashCookie(
      result.success ? `Sent ${amount} TRX successfully` : result.message || 'Failed to send',
      result.success ? 'success' : 'error',
      c.env
    ),
  });
});

// Templates
function renderAdminLogin(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Login - TRX Faucet</title>
    ${THEME_BOOTSTRAP}
  <link rel="stylesheet" href="//cdn.jsdelivr.net/bootstrap/3.3.4/css/bootstrap.min.css">
    <link rel="stylesheet" href="/theme.css">
  <style>
      body { background: var(--bg); color: var(--text-primary); min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); }
      .login-card { background: var(--surface); border: 1px solid var(--border); padding: 2rem; border-radius: var(--radius); box-shadow: var(--shadow-md); width: 100%; max-width: 400px; }
      .login-card h2 { color: var(--text-primary); }
    .form-group { margin-bottom: 1rem; }
      .form-group label { color: var(--text-secondary); }
      .form-control { width: 100%; padding: 0.75rem; background: var(--bg); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-ui); font-size: 1rem; }
      .form-control:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px var(--accent-subtle); }
      .btn-primary { background: var(--accent); border: none; width: 100%; padding: 0.75rem; font-weight: 600; }
      .btn-primary:hover, .btn-primary:focus { background: var(--accent-hover); }
      .alert { padding: 0.75rem 1rem; border-radius: var(--radius-ui); margin-bottom: 1rem; }
      .alert-danger { background: var(--danger-subtle); color: var(--danger); border: 1px solid var(--danger); }
      .theme-toggle { position: fixed; top: 1rem; right: 1rem; }
  </style>
</head>
<body>
    ${renderThemeToggle()}
  <div class="login-card">
    <h2 class="text-center mb-4">Admin Login</h2>
    <form method="post">
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" class="form-control" required autofocus>
      </div>
      <button type="submit" class="btn btn-primary">Login</button>
    </form>
  </div>
  ${THEME_RUNTIME}
</body>
</html>`;
}

interface AdminDashboardData {
  balance: string;
  totalClaims: number;
  totalUsers: number;
  totalPaid: number;
  recentClaims: { time: number; address: string; reward: number; ip: string }[];
  csrf: string;
  flash: { message: string; type: string } | null;
}

function renderAdminDashboard(data: AdminDashboardData): string {
  const flash = data.flash
    ? `<div class="alert alert-${data.flash.type === 'error' ? 'danger' : data.flash.type === 'success' ? 'success' : 'info'}">${escapeHtml(data.flash.message)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Dashboard - TRX Faucet</title>
    ${THEME_BOOTSTRAP}
  <link rel="stylesheet" href="//cdn.jsdelivr.net/bootstrap/3.3.4/css/bootstrap.min.css">
    <link rel="stylesheet" href="/theme.css">
  <style>
      body { font-family: var(--font-ui); background: var(--bg); color: var(--text-primary); }
      .navbar { background: var(--nav-bg); border-bottom: 1px solid var(--border); padding: 1rem 0; margin-bottom: 0; }
      .navbar .container { display: flex; align-items: center; gap: 0.5rem; }
      .navbar-brand { color: var(--text-primary); height: auto; padding: 0; }
      .navbar-brand:hover, .navbar-brand:focus { color: var(--accent); }
      .navbar .pull-right { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }
    .container { max-width: 1200px; }
      .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-ui); margin-bottom: 1.5rem; }
      .card-header { background: var(--surface-hover); color: var(--text-primary); border-bottom: 1px solid var(--border); padding: 1rem; font-weight: 600; }
    .stat-card { text-align: center; padding: 1.5rem; }
      .stat-value { font-size: 2rem; font-weight: 700; color: var(--accent); }
      .stat-label { color: var(--text-tertiary); font-size: 0.875rem; }
      .table { color: var(--text-primary); }
      .table th { background: var(--surface-hover); color: var(--text-secondary); }
      .table > tbody > tr > td { border-top-color: var(--border); }
      .table-striped > tbody > tr:nth-of-type(odd) { background: var(--surface-hover); }
      .btn { border-radius: var(--radius-ui); }
      .btn-default { background: var(--surface); border-color: var(--border); color: var(--text-primary); }
      .btn-default:hover, .btn-default:focus { background: var(--surface-hover); border-color: var(--border-strong); color: var(--text-primary); }
      .btn-primary { background: var(--accent); border-color: var(--accent); }
      .btn-primary:hover, .btn-primary:focus { background: var(--accent-hover); border-color: var(--accent-hover); }
      .form-control { background: var(--bg); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-ui); }
      .form-control:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-subtle); }
      .alert-success { background: var(--success-subtle); color: var(--success); border-color: var(--success); }
      .alert-danger { background: var(--danger-subtle); color: var(--danger); border-color: var(--danger); }
      .alert-info { background: var(--accent-subtle); color: var(--accent); border-color: var(--accent); }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="container">
      <a class="navbar-brand" href="/admin">TRX Faucet Admin</a>
      <div class="pull-right">
          ${renderThemeToggle()}
        <a href="/admin/settings" class="btn btn-default btn-sm">Settings</a>
        <a href="/admin/logout" class="btn btn-primary btn-sm">Logout</a>
      </div>
    </div>
  </nav>

  <div class="container" style="padding: 2rem 0;">
    ${flash}
    <div class="row">
      <div class="col-md-3"><div class="card stat-card"><div class="stat-value">${escapeHtml(data.totalClaims.toLocaleString())}</div><div class="stat-label">Total Claims</div></div></div>
      <div class="col-md-3"><div class="card stat-card"><div class="stat-value">${escapeHtml(data.totalUsers.toLocaleString())}</div><div class="stat-label">Unique Users</div></div></div>
      <div class="col-md-3"><div class="card stat-card"><div class="stat-value">${escapeHtml((data.totalPaid / 1_000_000).toFixed(2))} TRX</div><div class="stat-label">Total Paid</div></div></div>
      <div class="col-md-3"><div class="card stat-card"><div class="stat-value">${escapeHtml(data.balance)}</div><div class="stat-label">Faucet Balance</div></div></div>
    </div>

    <div class="card">
      <div class="card-header">Recent Claims</div>
      <div class="table-responsive">
        <table class="table table-striped">
          <thead><tr><th>Time</th><th>Address</th><th class="text-right">Reward</th><th>IP</th></tr></thead>
          <tbody>
            ${data.recentClaims
              .map(
                (claim) => `
              <tr>
                <td>${escapeHtml(new Date(claim.time * 1000).toLocaleString())}</td>
                <td>${escapeHtml(claim.address.slice(0, 8))}...${escapeHtml(claim.address.slice(-6))}</td>
                <td class="text-right">${escapeHtml(claim.reward.toLocaleString())} satoshi</td>
                <td>${escapeHtml(claim.ip)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Send Coins</div>
      <div class="card-body">
        <form method="post" action="/admin/send" class="form-inline">
          <input type="hidden" name="csrf" value="${escapeHtml(data.csrf)}">
          <div class="form-group">
            <input type="text" name="address" class="form-control" placeholder="TRX Address" required style="width: 300px;">
          </div>
          <div class="form-group">
            <input type="number" name="amount" class="form-control" placeholder="Amount (TRX)" step="0.000001" min="0.000001" required style="width: 150px;">
          </div>
          <button type="submit" class="btn btn-primary">Send</button>
        </form>
      </div>
    </div>
  </div>
  ${THEME_RUNTIME}
</body>
</html>`;
}

function renderAdminSettings(settings: Map<string, string>, csrf: string): string {
  const get = (key: string, def = '') => settings.get(key) || def;
  const checked = (key: string) => (get(key) === 'on' ? 'checked' : '');
  // Never echo stored secrets back into the page
  const hidden = (key: string) => (settings.get(key) ? '•••••••• (saved)' : '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Settings - TRX Faucet</title>
    ${THEME_BOOTSTRAP}
  <link rel="stylesheet" href="//cdn.jsdelivr.net/bootstrap/3.3.4/css/bootstrap.min.css">
    <link rel="stylesheet" href="/theme.css">
  <style>
      body { font-family: var(--font-ui); background: var(--bg); color: var(--text-primary); }
      .navbar { background: var(--nav-bg); border-bottom: 1px solid var(--border); padding: 1rem 0; margin-bottom: 0; }
      .navbar .container { display: flex; align-items: center; gap: 0.5rem; }
      .navbar-brand { color: var(--text-primary); height: auto; padding: 0; }
      .navbar-brand:hover, .navbar-brand:focus { color: var(--accent); }
      .navbar .pull-right { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }
    .container { max-width: 1000px; }
      .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-ui); margin-bottom: 1.5rem; }
      .card-header { background: var(--surface-hover); color: var(--text-primary); border-bottom: 1px solid var(--border); padding: 1rem; font-weight: 600; }
    .form-group { margin-bottom: 1rem; }
      .form-group label { color: var(--text-secondary); }
      .form-control { width: 100%; padding: 0.75rem; background: var(--bg); color: var(--text-primary); border: 1px solid var(--border); border-radius: var(--radius-ui); }
      .form-control:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px var(--accent-subtle); }
      .btn { border-radius: var(--radius-ui); }
      .btn-default { background: var(--surface); border-color: var(--border); color: var(--text-primary); }
      .btn-default:hover, .btn-default:focus { background: var(--surface-hover); border-color: var(--border-strong); color: var(--text-primary); }
      .btn-primary { background: var(--accent); border-color: var(--accent); }
      .btn-primary:hover, .btn-primary:focus { background: var(--accent-hover); border-color: var(--accent-hover); }
    .checkbox { display: flex; align-items: center; gap: 0.5rem; }
      .text-muted { color: var(--text-tertiary); }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="container">
      <a class="navbar-brand" href="/admin">TRX Faucet Admin</a>
      <div class="pull-right">
          ${renderThemeToggle()}
        <a href="/admin" class="btn btn-default btn-sm">Dashboard</a>
        <a href="/admin/logout" class="btn btn-primary btn-sm">Logout</a>
      </div>
    </div>
  </nav>

  <div class="container" style="padding: 2rem 0;">
    <form method="post" action="/admin/settings">
      <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
      <div class="card">
        <div class="card-header">FaucetPay Settings</div>
        <div class="card-body">
          <div class="form-group">
            <label>API Key</label>
            <input type="password" name="apikey" class="form-control" value="" placeholder="${escapeHtml(hidden('apikey') || 'FaucetPay API Key')}">
          </div>
          <div class="form-group">
            <label>User Token (optional)</label>
            <input type="password" name="usertoken" class="form-control" value="" placeholder="${escapeHtml(hidden('usertoken') || 'FaucetPay User Token')}">
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Faucet Settings</div>
        <div class="card-body">
          <div class="form-group">
            <label>Timer (minutes)</label>
            <input type="number" name="timer" class="form-control" value="${escapeHtml(get('timer', '5'))}" min="1">
          </div>
          <div class="form-group">
            <label>Rewards (format: weight*min-max,weight*value,...)</label>
            <input type="text" name="rewards" class="form-control" value="${escapeHtml(get('rewards'))}" style="font-family: monospace;">
          </div>
          <div class="form-group">
            <label>Referral %</label>
            <input type="number" name="referral" class="form-control" value="${escapeHtml(get('referral', '50'))}" min="0" max="100">
          </div>
          <div class="form-group">
            <label>Daily Claim Limit</label>
            <input type="number" name="limit_number_of_claims_per_24h" class="form-control" value="${escapeHtml(get('limit_number_of_claims_per_24h', '3'))}" min="0">
          </div>
          <div class="checkbox">
            <input type="checkbox" name="disallow_email_claiming" ${checked('disallow_email_claiming')}>
            <label>Disallow email addresses</label>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">Security</div>
        <div class="card-body">
          <p class="text-muted small">The Turnstile site key and secret are set as deployment configuration and cannot be changed here.</p>
          <div class="form-group">
            <label>Country Ban List (comma separated ISO codes)</label>
            <input type="text" name="country_ban_list" class="form-control" value="${escapeHtml(get('country_ban_list'))}">
          </div>
          <div class="form-group">
            <label>ASN Ban List (comma separated)</label>
            <input type="text" name="asn_ban_list" class="form-control" value="${escapeHtml(get('asn_ban_list'))}">
          </div>
          <div class="form-group">
            <label>IP Ban List (CIDR notation, comma separated)</label>
            <input type="text" name="ip_ban_list" class="form-control" value="${escapeHtml(get('ip_ban_list'))}">
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary">Save Settings</button>
    </form>
  </div>
  ${THEME_RUNTIME}
</body>
</html>`;
}
