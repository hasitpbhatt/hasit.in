# hasit.in — Unified Monorepo

One Cloudflare Worker serves every subdomain of `hasit.in`. The Worker handles hostname
routing, API endpoints, and server-rendered pages; static assets for the SPAs are served from
the same deployment through the `ASSETS` binding. There is a single D1 database (`hasit-in`)
holding all app data behind per-app table prefixes.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     hasit-in (single Worker)                  │
├──────────────────────────────────────────────────────────────┤
│  Host router (src/lib/host-routing.ts) resolves the app from  │
│  the request hostname:                                        │
│    hasit.in, www.hasit.in  → portfolio (server-rendered)      │
│    trx2.hasit.in           → TRX faucet (server-rendered)     │
│    freellm.hasit.in        → FreeLLM (SPA + Worker API)       │
│    fitness.hasit.in        → reverse proxy to the fitness app │
│    auth.hasit.in           → shared OAuth / JWT broker (API)  │
├──────────────────────────────────────────────────────────────┤
│  Static assets (public/, public/_spa/) served by ASSETS       │
├──────────────────────────────────────────────────────────────┤
│  D1 (hasit-in) with prefixes: core_, trx_, freellm_, fitness_,│
│  blog_, analytics_                                            │
├──────────────────────────────────────────────────────────────┤
│  Durable Objects: AuthState (sessions), RateLimiter           │
└──────────────────────────────────────────────────────────────┘
```

This is a Worker deployment, not a Pages project. It is configured in `wrangler.toml` and
released with `wrangler deploy`.

> **Deploy hazard.** `wrangler deploy` reconciles the account's Worker custom domains against
> the `routes` array and **deletes** any custom domain that is not listed, which also removes
> its DNS record. Every hostname must stay in `wrangler.toml`. Verify all six are bound after
> each deploy.

## Quick Start

```bash
npm ci
npm run check:config      # validate public config and ads.txt
npm run dev:keys          # generate local ES256 keys into .dev.vars
npm run dev               # http://localhost:8787

npm run deploy            # check:config → typecheck → test → build:apps → wrangler deploy
npm run deploy:dry        # same checks, bundle only
```

## Project Structure

```
hasit.in/
├── apps/freellm/                # FreeLLM app source (AGPL-3.0) and upstream schema
├── src/
│   ├── index.ts                 # Worker entry: host routing, security headers
│   ├── env.ts                   # Environment bindings and vars
│   ├── apps/
│   │   ├── portfolio/           # hasit.in and www.hasit.in
│   │   ├── trx/                 # TRX faucet (claim, admin, api, user page, templates)
│   │   ├── freellm/             # FreeLLM API mount
│   │   ├── fitness/             # Thin pass-through to the fitness app
│   │   └── blog/                # Blog stub (JSON only)
│   ├── lib/
│   │   ├── auth/                # JWT, Google OAuth, sessions, auth broker routes
│   │   ├── db/                  # queries.ts (non-TRX), trx-queries.ts
│   │   ├── host-routing.ts      # Hostname → app key, SPA asset roots
│   │   ├── trx-host.ts          # Faucet host resolution (trx2 today, trx later)
│   │   ├── fitness-proxy.ts     # Request/response forwarding for fitness
│   │   ├── theme.ts             # Theme bootstrap and toggle markup
│   │   ├── site-config.ts       # GA4, AdSense, Turnstile config
│   │   ├── ui-components.ts     # Shared page chrome
│   │   ├── quotes.ts            # Author page nav and quote-of-day
│   │   ├── cmc-widget.ts        # Coinmarketcap widget and footer links
│   │   ├── coingecko.ts         # CoinGecko client (Cache API backing)
│   │   ├── faucetpay.ts         # FaucetPay payouts
│   │   ├── streak.ts            # Daily claim streaks
│   │   ├── validator.ts         # Address validation, Turnstile, bans
│   │   └── html.ts              # Escaping helper
│   └── middleware/
│       ├── rate-limit.ts        # Per-key fixed-window limiting (Durable Object)
│       ├── security.ts          # IP/country/ASN bans, VPN/proxy detection
│       ├── security-headers.ts  # CSP, HSTS, Permissions-Policy
│       └── session.ts           # Claim/admin sessions, CSRF, flash
├── migrations/                  # Numbered SQL migrations
├── public/                      # Static assets (theme.css, theme.js, og.png, …)
│   └── _spa/                    # Built SPA bundles (freellm)
├── scripts/
│   ├── build-apps.js            # Builds SPAs, copies shared theme, writes sitemap
│   ├── generate-sitemap.js      # Standalone sitemap generator (keep in sync)
│   ├── check-config.js          # Validates public vars and ads.txt
│   ├── dev-keys.js              # Writes local ES256 keys to .dev.vars
│   ├── migrate.js               # Migration runner (--local / --remote)
│   └── smoke.js                 # Endpoint matrix against a running dev server
├── tests/                       # node --test suites
└── wrangler.toml
```

## Subdomains

| Hostname | App | Served by |
|----------|-----|-----------|
| `hasit.in`, `www.hasit.in` | Portfolio | Worker (server-rendered) |
| `trx2.hasit.in` | TRX Faucet | Worker (server-rendered) |
| `freellm.hasit.in` | FreeLLM | Worker API + SPA in `public/_spa/freellm/` |
| `fitness.hasit.in` | Fitness | Worker reverse proxy → `FITNESS_ORIGIN` |
| `auth.hasit.in` | Auth broker | Worker, **API only** (no browsable UI) |
| `quizify.hasit.in`, `blog.hasit.in` | Separate Pages projects | Not this Worker |

`trx.hasit.in` is a **legacy Pages project** (`trx-hasit-in`), not a route of this Worker. Do not
add it to `wrangler.toml` until it has been detached from that Pages project; the faucet host
will move from `trx2` to `trx` once parity is reached.

## Hostname-resolution rule

Never hardcode a hostname literal in a template. Derive it from the request so the app keeps
working when a hostname moves:

```ts
import { resolveTrxHost, resolveTrxOrigin } from './lib/trx-host';

const host = resolveTrxHost(request);    // allowlisted, falls back to trx2.hasit.in
const origin = resolveTrxOrigin(request); // `https://${host}`
```

`TRX_PUBLIC_ORIGIN` is the single accepted literal, used only by the static portfolio page.
`tests/trx-host.test.ts` covers the allowlist, port stripping, and spoofed `X-Hasit-Host`.

## Static Assets and the Shared Theme

`npm run build:apps` builds FreeLLM with Vite and stages it under `public/_spa/freellm/`. It also
copies the shared design system into each SPA output and regenerates `public/sitemap.xml`.

Every app shares one visual language from `public/theme.css`:

- Light and dark token sets selected by `html.light-theme` / `html.dark-theme`, with a
  `prefers-color-scheme` fallback.
- The same font stack (Inter for UI, JetBrains Mono for code) and the same accent
  (`#5B5BD6` light, `#7C7CE6` dark).
- One toggle contract: `<button class="theme-toggle" data-theme-toggle>` containing exactly two
  `<svg>` children, `.icon-sun` and `.icon-moon`.

`public/theme.js` handles clicks through a single document-level delegated listener. Do not add
an `onClick` to a `[data-theme-toggle]` element — a second handler cancels the toggle out.

`public/_headers` controls cache and response headers for static files.

## Database (single D1: `hasit-in`)

| Prefix | Tables | Purpose |
|--------|--------|---------|
| `core_` | `users`, `user_apps`, `sessions` | Shared identity and auth |
| `trx_` | `settings`, `claimlog`, `ips`, `addresses`, `refs`, `pages`, `locks`, `ProxyCheck`, `NH_Log`, `streaks` | Faucet state and security checks |
| `freellm_` | User, auth, usage, key, and service tables; `runtime_state` | FreeLLM API and expiring runtime state |
| `fitness_` | `workouts`, `goals`, `streaks` | Fitness tracker |
| `blog_` | `posts`, `tags`, `post_tags` | Blog |
| `analytics_` | `events` | Cross-app analytics |

Table names above are suffixes of their prefix (`core_users`, `analytics_events`, …).
`trx_claimlog` intentionally has **no** shortlink column; shortlinks were removed.

### Migrations

| Migration | Contents |
|-----------|----------|
| `001_core_auth.sql` | Core authentication tables |
| `002_freellm.sql` | Legacy FreeLLM tables |
| `003_fitness.sql` | Fitness tables |
| `006_blog.sql` | Blog tables |
| `009_analytics.sql` | Cross-app analytics |
| `010_trx_faucet.sql` | Faucet tables (idempotent; includes `ProxyCheck` and `NH_Log`) |
| `011_trx_streaks.sql` | Daily claim streaks |
| `012_freellm_runtime_state.sql` | D1-backed FreeLLM sessions, OAuth state, rate-limit counters |

```bash
npm run db:migrate:local    # local D1
npm run db:migrate:remote   # remote D1
```

Applying a migration runs the whole numbered chain, so review new files before running it.
Migrations are not applied automatically on deploy.

## Authentication

`auth.hasit.in` is the shared broker and exposes only JSON endpoints: `/login/:app`,
`/callback`, `/exchange`, `/refresh/:app`, `/revoke/:app`, `/me`, and `/health`. It issues scoped
ES256 JWTs (15-minute access tokens, 30-day refresh tokens) that apps validate locally, with a
per-app revocation path. There is no sign-in page on that host.

The TRX faucet is unauthenticated by design and does not use Google sign-in; it relies on
Turnstile plus its own claim session. FreeLLM keeps its own account model and needs
`ENCRYPTION_KEY` for its key vault and `RESEND_API_KEY` for verification mail, with Google OAuth
allowing `https://freellm.hasit.in/api/auth/google/callback`.

## Fitness proxy

`fitness.hasit.in` is served by a separate app. The Worker forwards the request to
`FITNESS_ORIGIN` unchanged (`src/lib/fitness-proxy.ts`) and returns the response as-is: the
upstream app owns its cookies, redirects, and SPA fallback. `securityHeadersMiddleware()`
deliberately skips fitness so its own CSP and `Permissions-Policy` (which must keep
`camera=(self)`) survive.

## Configuration

Public values in `wrangler.toml` under `[vars]`:

| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT` | Runtime environment name |
| `GA_ID` | GA4 measurement ID |
| `ADSENSE_CLIENT` | AdSense publisher ID |
| `TURNSTILE_SITE_KEY` | Turnstile site key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_REDIRECT_URI` | OAuth callback (`https://auth.hasit.in/callback`) |
| `FITNESS_ORIGIN` | Upstream origin for the fitness proxy |

`npm run check:config` asserts these are well-formed and that `public/ads.txt` matches
`ADSENSE_CLIENT`. GA4 and AdSense IDs are read through `getSiteConfig(env)` and are never
hardcoded in templates.

### Secrets (`wrangler secret put`)

| Secret | Purpose |
|--------|---------|
| `TURNSTILE_SECRET` | Turnstile verification |
| `FAUCETPAY_API_KEY` | Payouts |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | ES256 signing (public key derived if absent) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `FREELLM_API_KEY` / `FREELLM_MODEL` | Default FreeLLM upstream |
| `ENCRYPTION_KEY` | FreeLLM key-vault encryption |
| `RESEND_API_KEY` | FreeLLM email verification |
| `ADMIN_PASSWORD` | Bootstraps the first faucet admin login only |

```bash
openssl ecparam -name prime256v1 -genkey -noout -out private.pem
openssl ec -in private.pem -pubout -out public.pem
```

## Local Development

`npm run dev` starts Wrangler at `http://localhost:8787`. Miniflare rewrites local request URLs to
the first `custom_domain` route, so `Host` is unreliable locally; select an app with the
development-only `X-Hasit-Dev-App` header (empty value selects the portfolio). The header is
ignored unless `ENVIRONMENT` is `development`.

```bash
curl -H "X-Hasit-Dev-App: freellm" http://localhost:8787/health
curl -H "X-Hasit-Dev-App:" http://localhost:8787/          # portfolio
node scripts/smoke.js                                      # full endpoint matrix
```

## npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Worker (`predev` runs check:config and build:apps) |
| `npm run dev:keys` | Generate local JWT keys into `.dev.vars` |
| `npm run typecheck` | Strict `tsc --noEmit` |
| `npm test` | `node --test tests/*.test.ts` |
| `npm run lint` | ESLint over `src/` |
| `npm run check` | typecheck + test + deploy:dry |
| `npm run deploy` | Full gate then `wrangler deploy` |
| `npm run deploy:dry` | check:config + build:apps + bundle only |
| `npm run build:apps` | Build SPAs, copy theme, write sitemap |
| `npm run db:migrate:local` / `:remote` | Apply migrations |
| `npm run check:config` | Validate config and ads.txt |

## CI/CD

`.github/workflows/deploy.yml` deploys on push to `main`; `.github/workflows/pr-gate.yml` runs
typecheck, tests, and `deploy:dry` on pull requests. Migrations need a manual
`workflow_dispatch` with `run_migrations=true`.

## Adding a New App

1. Create `src/apps/<app>/index.ts` exporting a Hono router.
2. Add tables under a new prefix in a numbered migration.
3. Add query helpers in `src/lib/db/queries.ts`.
4. Register the app in `APP_ROUTES` (`src/index.ts`) and `SUBDOMAIN_APPS`
   (`src/lib/host-routing.ts`).
5. Add the hostname to `routes` in `wrangler.toml` — omitting it will not 404, it will delete the
   domain on the next deploy.
6. Configure rate limits in `src/middleware/rate-limit.ts`.
7. For an SPA, add a build step to `scripts/build-apps.js`, call `copySharedTheme(output)`, and
   extend both sitemap generators.
8. Add tests in `tests/`.

## License

`apps/freellm/` is licensed AGPL-3.0; keep its notices and `apps/freellm/LICENSE` when
distributing or operating it. Everything else is MIT.
