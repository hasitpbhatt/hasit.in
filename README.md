# hasit.in — Unified Monorepo

All Hasit.in subdomains are served by one Cloudflare Worker, backed by one D1 database and deployed as one Worker.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    hasit-in (single Worker)                  │
├─────────────────────────────────────────────────────────────┤
│  Host Router (src/index.ts) routes by hostname:            │
│  • hasit.in, www.hasit.in → Personal portfolio              │
│  • trx.hasit.in, trx2.hasit.in → TRX Faucet                │
│  • freellm.hasit.in    → LLM API Validator                  │
│  • fitness.hasit.in    → Workout Tracker                    │
│  • finance.hasit.in    → Portfolio Tracker                  │
│  • blog.hasit.in       → Blog/Articles                      │
│  • quiz.hasit.in       → Quiz Platform                      │
│  • games.hasit.in      → Browser Games                      │
│  • auth.hasit.in       → Shared OAuth + JWT                 │
├─────────────────────────────────────────────────────────────┤
│  Cloudflare static assets (public/) served directly         │
├─────────────────────────────────────────────────────────────┤
│                     Single D1 Database (hasit-in)           │
│                     Table prefixes: core_, trx_, freellm_,  │
│                     fitness_, finance_, blog_, quiz_,       │
│                     games_, analytics_                     │
└─────────────────────────────────────────────────────────────┘
```

This is a Cloudflare Worker deployment, not a Cloudflare Pages project. The Worker is configured in `wrangler.toml` and deployed with `wrangler deploy` (or `npm run deploy`).

## Quick Start

```bash
# Install dependencies
npm install

# Validate public configuration and ads.txt
npm run check:config

# Run migrations against the local D1 database
npm run db:migrate

# Generate local JWT keys (writes .dev.vars)
npm run dev:keys

# Develop locally at http://localhost:8787
npm run dev

# Deploy the Worker
npm run deploy
```

## Project Structure

```
hasit.in/
├── src/
│   ├── index.ts                 # Host router (routes by hostname)
│   ├── apps/
│   │   ├── trx/                 # TRX Faucet
│   │   ├── portfolio/           # Personal portfolio (hasit.in)
│   │   ├── freellm/             # LLM API Validator (stub)
│   │   ├── fitness/             # Fitness Tracker (stub)
│   │   ├── finance/             # Finance Tracker (stub)
│   │   ├── blog/                # Blog (stub)
│   │   ├── quiz/                # Quiz Platform (stub)
│   │   └── games/               # Games (stub)
│   ├── lib/
│   │   ├── auth/                # Shared auth: JWT, Google OAuth, sessions
│   │   ├── db/
│   │   │   ├── queries.ts       # Typed query helpers for non-TRX apps
│   │   │   └── trx-queries.ts   # TRX faucet query helpers
│   │   ├── site-config.ts       # GA4, AdSense, and Turnstile site config
│   │   ├── html.ts              # HTML escaping helper
│   │   ├── faucetpay.ts         # FaucetPay client
│   │   ├── coingecko.ts         # CoinGecko price cache (KV)
│   │   └── validator.ts         # Address validation, Turnstile, rate limits
│   └── middleware/
│       ├── rate-limit.ts        # Per-app rate limiting (KV)
│       ├── security.ts          # VPN/proxy checks, ban lists
│       └── session.ts           # Claim/admin sessions, CSRF, flash
├── migrations/                  # Numbered SQL migrations
├── public/                      # Static assets served by Cloudflare
├── scripts/migrate.js           # Migration runner
├── wrangler.toml                # Worker, D1, KV, assets, and public vars
└── package.json
```

## Static Assets

Static files live in `public/`. Cloudflare serves them directly through the `[assets]` binding configured in `wrangler.toml`; requests for matching assets do not invoke the Worker.

There is no asset build step and no inlined asset bundle. Add or edit files in `public/` as-is. `public/_headers` controls cache headers and other response headers for those assets.

## Database (Single D1: `hasit-in`)

| Prefix | Tables | Purpose |
|--------|--------|---------|
| `core_` | `users`, `user_apps`, `sessions` | Shared identity and auth |
| `trx_` | `settings`, `claimlog`, `ips`, `addresses`, `refs`, `pages`, `locks`, `ProxyCheck`, `NH_Log` | TRX Faucet and security checks |
| `freellm_` | `validations`, `api_keys` | LLM Validator |
| `fitness_` | `workouts`, `goals`, `streaks` | Fitness Tracker |
| `finance_` | `portfolios`, `holdings`, `transactions` | Finance Tracker |
| `quiz_` | `quizzes`, `questions`, `attempts` | Quiz Platform |
| `blog_` | `posts`, `tags`, `post_tags` | Blog |
| `games_` | `scores` | Games |
| `analytics_` | `events` | Cross-app analytics |

The table names in this table are suffixes of their prefix; for example, `core_users` and `analytics_events`.

### Migrations

| Migration | Contents |
|-----------|----------|
| `001_core_auth.sql` | Core authentication tables |
| `002_freellm.sql` | FreeLLM tables |
| `003_fitness.sql` | Fitness tables |
| `004_finance.sql` | Finance tables |
| `005_quiz.sql` | Quiz tables |
| `006_blog.sql` | Blog tables |
| `007_games.sql` | Games tables |
| `009_analytics.sql` | Cross-app analytics table |
| `010_trx_faucet.sql` | TRX faucet tables; idempotent, and creates or ensures the TRX tables including `trx_ProxyCheck` and `trx_NH_Log` required by the security middleware |

Run migrations against local D1 first, then against the remote database when deploying:

```bash
# Local
npm run db:migrate

# Remote (production)
npm run db:migrate:remote
```

## Authentication

The `auth.hasit.in` Durable Object handles:
- Google OAuth callback
- Scoped JWT issuance (15-minute access tokens, 30-day refresh tokens)
- Per-app token revocation
- Local JWT validation in apps (no network hop)

Each app receives `Authorization: Bearer <jwt>` with `app` and `scope` claims.

## Public Configuration

The following values are public Worker variables in `wrangler.toml` under `[vars]`:

| Variable | Purpose |
|----------|---------|
| `ENVIRONMENT` | Runtime environment name |
| `GA_ID` | GA4 measurement ID |
| `ADSENSE_CLIENT` | Google AdSense client ID |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL |

GA4 and AdSense identifiers are not hardcoded in page templates. `src/lib/site-config.ts` reads them from the Worker environment through `getSiteConfig(env)`, and templates use the provided rendering helpers. `public/ads.txt` advertises the AdSense publisher and is validated against `ADSENSE_CLIENT` by `npm run check:config`.

`GOOGLE_CLIENT_SECRET` is a secret and must not be placed in `[vars]`.

## Required Secrets (set via `wrangler secret put`)

| Secret | Purpose |
|--------|---------|
| `TURNSTILE_SECRET` | Cloudflare Turnstile verification |
| `FAUCETPAY_API_KEY` | FaucetPay API key |
| `FAUCETPAY_USER_TOKEN` | FaucetPay user token |
| `JWT_PRIVATE_KEY` | ES256 PEM private key |
| `JWT_PUBLIC_KEY` | ES256 PEM public key |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ADMIN_PASSWORD` | Only needed until the admin password has been stored in `trx_settings`; it bootstraps the first login |

Set each secret with a command such as:

```bash
wrangler secret put SECRET_NAME
```

Generate ES256 keys:

```bash
openssl ecparam -name prime256v1 -genkey -noout -out private.pem
openssl ec -in private.pem -pubout -out public.pem
```

## Local Development

`npm run dev` starts Wrangler at `http://localhost:8787`. The TRX faucet is the default local app, and the auth app is also mounted at `/auth/*`.

To exercise another app locally, set the development-only `X-Hasit-Dev-App` header (an empty value selects the portfolio). Miniflare rewrites local request URLs to the first `custom_domain` route, so a `Host` header is not reliable in development. The header is ignored when `ENVIRONMENT` is not `development`.

```bash
curl -H "X-Hasit-Dev-App: freellm" http://localhost:8787/health
curl -H "X-Hasit-Dev-App:" http://localhost:8787/   # portfolio
```

`node scripts/smoke.js` exercises the full endpoint matrix against a running `npm run dev`.

Use `npm run dev:keys` to generate a local ES256 key pair in `.dev.vars` before exercising JWT-based flows.

## npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the local Worker development server |
| `npm run dev:keys` | Generate local JWT signing keys in `.dev.vars` |
| `npm run typecheck` | Run strict TypeScript checks without emitting files |
| `npm test` | Run the Node test runner (`node --test`) |
| `npm run lint` | Lint TypeScript sources |
| `npm run check` | Run typecheck, tests, and a deployment dry run |
| `npm run deploy` | Deploy the Cloudflare Worker with Wrangler |
| `npm run deploy:dry` | Validate and bundle the Worker without deploying |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:migrate:remote` | Apply migrations to remote D1 |
| `npm run check:config` | Validate public configuration and `public/ads.txt` |

## Adding a New App

1. Create `src/apps/<app>/index.ts` with a Hono router.
2. Add tables using an app-specific prefix in a new migration.
3. Add typed query helpers in `src/lib/db/queries.ts`.
4. Register the app in `APP_ROUTES` in `src/index.ts` and add its hostname to `wrangler.toml`.
5. Add rate-limit configuration in `src/middleware/rate-limit.ts`.
6. Run the migration and deploy with `npm run deploy`.

## Deployment

This repository deploys a Cloudflare Worker, not Cloudflare Pages.

```bash
# Deploy the Worker
npm run deploy

# Validate and bundle without deploying
npm run deploy:dry
```

## Subdomains

| Hostname | App | Status |
|----------|-----|--------|
| `hasit.in`, `www.hasit.in` | Portfolio | ✅ Built |
| `trx.hasit.in`, `trx2.hasit.in` | TRX Faucet | ✅ Built |
| `freellm.hasit.in` | LLM Validator | 🔲 Stub |
| `fitness.hasit.in` | Fitness | 🔲 Stub |
| `finance.hasit.in` | Finance | 🔲 Stub |
| `blog.hasit.in` | Blog | 🔲 Stub |
| `quiz.hasit.in` | Quiz | 🔲 Stub |
| `games.hasit.in` | Games | 🔲 Stub |
| `auth.hasit.in` | Auth Durable Object | ✅ Built |

## License

MIT
