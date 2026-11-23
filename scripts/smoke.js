#!/usr/bin/env node
// End-to-end smoke test against a running Worker.
//
//   npm run dev            # in one terminal
//   node scripts/smoke.js  # in another
//
// Exits non-zero on the first failed expectation, so CI can gate on it.

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8787';

let failures = 0;
let ipCounter = 0;
// Unique per run: a reused IP would trip the faucet's 5-minute IP timer.
const ipBase = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** A syntactically valid TRX address that has never claimed before. */
function randomAddress() {
  let suffix = '';
  for (let i = 0; i < 33; i += 1) {
    suffix += BASE58[Math.floor(Math.random() * BASE58.length)];
  }
  return `T${suffix}`;
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`✔ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`✖ ${name}`);
    console.error(`  ${err && err.message ? err.message : err}`);
  }
}

// Miniflare rewrites local requests to the first custom_domain route, so the
// Worker exposes a development-only app selector. Production ignores it.
const HOST_APPS = {
  localhost: 'trx',
  'hasit.in': '',
  'www.hasit.in': '',
  'trx.hasit.in': 'trx',
  'trx2.hasit.in': 'trx',
  'freellm.hasit.in': 'freellm',
  'fitness.hasit.in': 'fitness',
  'finance.hasit.in': 'finance',
  'blog.hasit.in': 'blog',
  'quiz.hasit.in': 'quiz',
  'games.hasit.in': 'games',
  'auth.hasit.in': 'auth',
};

async function request(path, host, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Host: host,
      'X-Hasit-Dev-App': HOST_APPS[host] ?? 'trx',
      // A unique client per check keeps one check's rate limit out of another.
      'CF-Connecting-IP': `${ipBase}.${++ipCounter}`,
      ...(options.headers || {}),
    },
    redirect: options.redirect ?? 'manual',
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { response, text, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log(`smoke: ${BASE}\n`);

// --- plan.md Phase 4 endpoint table (localhost defaults to the faucet) ---
await check('GET / serves the faucet', async () => {
  const { response, text } = await request('/', 'localhost');
  assert(response.status === 200, `status ${response.status}`);
  assert(text.includes('TRX'), 'no faucet markup in body');
});

await check('plain GET / issues a session and CSRF token', async () => {
  const { response, text } = await request('/', 'localhost');
  assert(response.status === 200, `status ${response.status}`);
  const session = text.match(/name="session" value="([^"]+)"/)?.[1];
  const csrf = text.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert(session && session.length > 20, 'plain GET did not issue a session token');
  assert(csrf && csrf.length > 10, 'plain GET did not issue a CSRF token');
});

await check('GET /admin/login serves the admin login', async () => {
  const { response, text } = await request('/admin/login', 'localhost');
  assert(response.status === 200, `status ${response.status}`);
  assert(text.includes('Admin Login'), 'no admin login markup in body');
});

await check('GET /api/price returns json', async () => {
  const { response, body } = await request('/api/price', 'localhost');
  assert(response.status === 200, `status ${response.status}`);
  assert(body && typeof body.usd === 'number', 'no usd price');
  assert(typeof body.btc === 'number', 'no btc price');
  assert(typeof body.usd_24h_change === 'number', 'no 24h change');
});

await check('GET /api/stats returns json', async () => {
  const { response, body } = await request('/api/stats', 'localhost');
  assert(response.status === 200, `status ${response.status}`);
  assert(body && typeof body.totalClaims === 'number', 'no totalClaims');
  assert(typeof body.totalUsers === 'number', 'no totalUsers');
  assert(typeof body.totalPaid === 'number', 'no totalPaid');
});

await check('GET /health identifies the faucet', async () => {
  const { response, body } = await request('/health', 'localhost');
  assert(response.status === 200, `status ${response.status}`);
  assert(body.app === 'trx-faucet', `app ${body && body.app}`);
});

await check('GET /auth/health identifies auth', async () => {
  const { response, body } = await request('/auth/health', 'localhost');
  assert(response.status === 200, `status ${response.status}`);
  assert(body.service === 'auth', `service ${body && body.service}`);
});

// --- subdomain matrix ---
const SUBDOMAINS = [
  ['hasit.in', 'portfolio'],
  ['trx.hasit.in', 'trx-faucet'],
  ['trx2.hasit.in', 'trx-faucet'],
  ['freellm.hasit.in', 'freellm'],
  ['fitness.hasit.in', 'fitness'],
  ['finance.hasit.in', 'finance'],
  ['blog.hasit.in', 'blog'],
  ['quiz.hasit.in', 'quiz'],
  ['games.hasit.in', 'games'],
];

for (const [host, app] of SUBDOMAINS) {
  await check(`GET /health on ${host} -> ${app}`, async () => {
    const { response, body } = await request('/health', host);
    assert(response.status === 200, `status ${response.status}`);
    assert(body.app === app, `app ${body && body.app}`);
  });
}

await check('GET /health on auth.hasit.in -> auth service', async () => {
  const { response, body } = await request('/health', 'auth.hasit.in');
  assert(response.status === 200, `status ${response.status}`);
  assert(body.service === 'auth', `service ${body && body.service}`);
});

// SPA deep links must resolve at clean subdomain URLs, including dynamic
// client-side routes. Otherwise the app shell loads but React renders nothing.
for (const path of ['/', '/chat', '/r/test123']) {
  await check(`GET ${path} on freellm.hasit.in serves the SPA`, async () => {
    const { response, text } = await request(path, 'freellm.hasit.in');
    assert(response.status === 200, `status ${response.status}`);
    assert(text.includes('<div id="root"></div>'), 'SPA root element missing');
    assert(response.headers.get('x-hasit-app') === 'freellm', 'wrong app header');
  });
}

for (const path of ['/apps', '/apps/freellm/chat', '/_spa/freellm/index.html']) {
  await check(`GET ${path} is not publicly exposed`, async () => {
    const { response } = await request(path, 'freellm.hasit.in');
    assert(response.status === 404, `status ${response.status}`);
  });
}

// --- static assets are served by Cloudflare, not the Worker ---
await check('GET /styles-trx.css is served', async () => {
  const { response, text } = await request('/styles-trx.css', 'trx.hasit.in');
  assert(response.status === 200, `status ${response.status}`);
  assert(text.includes('--accent'), 'not the trx stylesheet');
});

await check('GET /ads.txt is served', async () => {
  const { response, text } = await request('/ads.txt', 'trx.hasit.in');
  assert(response.status === 200, `status ${response.status}`);
  assert(text.includes('pub-'), 'no publisher id in ads.txt');
});

await check('GET /books/what-is-a-man-fixing.html is served', async () => {
  // Static assets redirect .html to the clean URL on purpose.
  const { response, text } = await request('/books/what-is-a-man-fixing.html', 'hasit.in', {
    redirect: 'follow',
  });
  assert(response.status === 200, `status ${response.status}`);
  assert(text.includes('What Is a Man Fixing'), 'book page missing');
});

// --- claim flow guards ---
await check('POST / without a session is rejected', async () => {
  const { response, body } = await request('/', 'localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'address=T123',
  });
  assert(response.status === 400, `status ${response.status}`);
  assert(body && body.error, 'no error message');
});

await check('GET /admin redirects to the login page', async () => {
  const { response } = await request('/admin', 'localhost');
  assert(response.status === 302, `status ${response.status}`);
});

await check('a full claim succeeds in local mock mode', async () => {
  // A fresh address per run, otherwise the claim timer blocks the next run.
  const address = randomAddress();
  const page = await request(`/?address=${address}`, 'localhost');
  assert(page.response.status === 200, `page status ${page.response.status}`);

  const session = page.text.match(/name="session" value="([^"]+)"/)?.[1];
  const csrf = page.text.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert(session && csrf, 'the claim page did not issue a session and CSRF token');

  const body = new URLSearchParams({
    address,
    session,
    csrf,
    'cf-turnstile-response': 'local-test-token',
    ref: '',
  });
  const { response, text } = await request('/', 'localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  assert(response.status === 302, `status ${response.status}: ${text.slice(0, 200)}`);
  assert(response.headers.get('Location') === '/', 'claim did not redirect home');

  const cookies = response.headers.getSetCookie();
  assert(cookies.length >= 2, `expected separate session and flash cookies, got ${cookies.length}`);
});

await check('a claim succeeds with a session from a plain GET', async () => {
  // The user pastes an address into the form after the page loaded, so the
  // session is minted with no bound address.
  const address = randomAddress();
  const page = await request('/', 'localhost');
  assert(page.response.status === 200, `page status ${page.response.status}`);

  const session = page.text.match(/name="session" value="([^"]+)"/)?.[1];
  const csrf = page.text.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert(session && csrf, 'the plain GET page did not issue a session and CSRF token');

  const body = new URLSearchParams({
    address,
    session,
    csrf,
    'cf-turnstile-response': 'local-test-token',
    ref: '',
  });
  const { response, text } = await request('/', 'localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  assert(response.status === 302, `status ${response.status}: ${text.slice(0, 200)}`);
  assert(response.headers.get('Location') === '/', 'claim did not redirect home');
});

await check('admin login authenticates and opens the dashboard', async () => {
  // The first login stores a hash in trx_settings, so later runs use the
  // database copy. Override with SMOKE_ADMIN_PASSWORD if yours differs.
  const password = process.env.SMOKE_ADMIN_PASSWORD || 'local-admin-password';

  const { response } = await request('/admin/login', 'localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password }).toString(),
  });

  assert(response.status === 302, `status ${response.status}`);
  assert(response.headers.get('Location') === '/admin', 'did not redirect to the dashboard');

  const cookie = response.headers.getSetCookie().find((value) => value.startsWith('admin_session='));
  assert(cookie, 'no admin session cookie was issued');

  const dashboard = await request('/admin', 'localhost', {
    headers: { Cookie: cookie.split(';')[0] },
  });
  assert(dashboard.response.status === 200, `dashboard status ${dashboard.response.status}`);
  assert(dashboard.text.includes('Total Claims'), 'dashboard markup is missing');
});

console.log(`\n${failures === 0 ? 'smoke passed' : `smoke FAILED (${failures})`}`);
process.exit(failures === 0 ? 0 : 1);
