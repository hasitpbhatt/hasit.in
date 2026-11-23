# hasit.in Monorepo - Implementation Plan

> **Status**: Local implementation is in progress. The Worker has static app staging for FreeLLM/Games/Fitness/Finance/Quiz, FreeLLM and Games API integration, Finance API routes, and the Quiz AI proxy. Production D1 changes, deployment, DNS cutover, and legacy-service decommissioning remain gated.
> **Target**: Serve the available package applications through one Worker and Assets pipeline. Interview remains a separate Cloudflare Pages Next.js SSR deployment.
> Only the root `plan.md` is checked into this worktree. Interview's source and locked plan were inspected in its separate Pages repository; its Pages-local D1/password auth remains unchanged, with no planned shared Worker auth bridge. FreeLLM source is imported under `apps/freellm` with its AGPL-3.0 license; its current schema chain still conflicts with the root legacy migration and is gated.

---

## 🎯 Goal

Consolidate the available applications behind one Cloudflare Worker and Assets binding, with one D1 database using app prefixes. Five SPAs are planned (FreeLLM, Fitness, Quiz, Games, Finance); all five sources/builds are integrated into the asset pipeline, with Interview remaining separately deployed on Cloudflare Pages.

---

## 📁 Complete File Structure

```
hasit.in/
├── apps/                               # Imported application sources
│   ├── freellm/                        # AGPL-3.0 source and upstream schema history
│   ├── fitness/
│   ├── finance/
│   ├── games/
│   └── quiz/
├── .github/workflows/deploy.yml        # Worker CI/CD and opt-in migration job
├── .nvmrc                              # Node 22
├── package.json                        # Root package and scripts
├── package-lock.json                   # Locked dependencies
├── tsconfig.json                       # Strict TypeScript config
├── wrangler.toml                       # Cloudflare Worker config
├── plan.md                             # This file
├── README.md                           # Project documentation
├── public/                             # Static assets served by Cloudflare
│   ├── styles.css
│   ├── styles-trx.css
│   ├── memory-game.js
│   ├── interactions.js
│   └── ...
├── scripts/
│   ├── build-apps.js                   # Builds/stages available SPAs
│   ├── check-config.js                 # Configuration guard
│   ├── dev-keys.js                     # Local development keys
│   └── migrate.js                      # Sequential D1 migration runner
├── migrations/
│   ├── 001_core_auth.sql               # Core users, apps, sessions
│   ├── 002_freellm.sql                 # Legacy FreeLLM tables; schema conflict gated
│   ├── 003_fitness.sql                 # Fitness tables
│   ├── 004_finance.sql                 # Finance tables
│   ├── 005_quiz.sql                    # Quiz tables
│   ├── 006_blog.sql                    # Blog tables
│   ├── 007_games.sql                   # Games tables
│   ├── 009_analytics.sql               # Cross-app analytics
│   ├── 010_trx_faucet.sql              # Idempotent TRX faucet tables
│   ├── 011_games_platform.sql          # Games API schema
│   └── 012_freellm_runtime_state.sql   # D1-backed FreeLLM expiring state
├── src/
│   ├── env.d.ts                        # Worker environment and binding types
│   ├── index.ts                        # Host router and Worker entry point
│   ├── apps/
│   │   ├── trx/                        # TRX Faucet - complete
│   │   │   ├── index.ts
│   │   │   └── routes/
│   │   ├── portfolio/                  # Portfolio - complete
│   │   ├── freellm/                    # API mount and D1-backed state adapter
│   │   ├── fitness/                    # SPA host and health routes
│   │   ├── finance/                    # Imported market-data APIs
│   │   ├── blog/                       # Stub
│   │   ├── quiz/                       # Imported AI proxy
│   │   └── games/                      # Imported Pages API adapter
│   ├── lib/
│   │   ├── auth/                       # JWT, Google OAuth, sessions, auth DO
│   │   ├── db/trx-queries.ts           # TRX queries
│   │   ├── site-config.ts              # Environment-driven site identifiers
│   │   ├── faucetpay.ts                # FaucetPay client
│   │   ├── coingecko.ts                # CoinGecko edge cache (no KV)
│   │   ├── host-routing.ts             # Hostname-to-app routing
│   │   └── validator.ts                # Address validation, Turnstile
│   ├── middleware/
│   │   ├── rate-limit.ts               # Per-app rate limiting (Durable Object)
│   │   ├── security.ts                 # Cloudflare country/ASN/IP/hostname bans, NastyHosts check
│   │   └── session.ts                  # Claim/admin sessions and CSRF
│   └── types/context.d.ts              # Shared context types
├── tests/                              # Node built-in test suite
└── types/                              # Shared types, if needed
```

DevCheap is no longer part of this monorepo, so there is no `src/apps/devcheap/` directory and no `migrations/008_devcheap.sql`.

---

## 🔧 Phase 1: TypeScript Compilation (RESOLVED)

The compile errors listed in the old error table are already resolved. `npm run typecheck` now completes with 0 errors. The old plan's detailed fix list is no longer an implementation task.

Two instructions in the old plan were factually wrong and were deliberately **not** followed:

1. **Hono generic:** `new Hono<Env>()` is malformed Hono usage. The correct generic is `Hono<{ Bindings: Env }>`, which is what the code uses. The application registry is typed as `Record<string, Hono<AppEnv>>` with `AppEnv = { Bindings: Env }`.
2. **Migration 010:** `migrations/010_trx_faucet.sql` **is kept**. The code queries `trx_ProxyCheck` and `trx_NH_Log`, but the old "already exists" TRX table list omitted both tables. Migration 010 creates those tables and is safe to apply to the existing database.

The `googleapis` npm package has also been removed; the Worker bundle is now tiny.

---

## 🗄️ Phase 2: Database Migrations

### Run Order

Migrations run sequentially in filename order:

```bash
# Local development
npm run db:migrate

# Production (remote; gated pending schema inventory and explicit approval)
npm run db:migrate:remote
```

### Migration Files

| File | Tables | Dependencies |
|------|--------|--------------|
| `001_core_auth.sql` | `core_users`, `core_user_apps`, `core_sessions` | None |
| `002_freellm.sql` | Legacy `freellm_validations`, `freellm_api_keys` | `core_users`; conflicts with upstream FreeLLM schema |
| `003_fitness.sql` | `fitness_workouts`, `fitness_goals`, `fitness_streaks` | `core_users` |
| `004_finance.sql` | `finance_portfolios`, `finance_holdings`, `finance_transactions` | `core_users` |
| `005_quiz.sql` | `quiz_quizzes`, `quiz_questions`, `quiz_attempts` | `core_users` |
| `006_blog.sql` | `blog_posts`, `blog_tags`, `blog_post_tags` | `core_users` |
| `007_games.sql` | `games_scores` | `core_users` |
| `009_analytics.sql` | `analytics_events` | `core_users` |
| `010_trx_faucet.sql` | TRX settings, claims, IPs, referrals, pages, locks, `trx_ProxyCheck`, `trx_NH_Log` | None |
| `011_games_platform.sql` | Prefixed tables used by imported Games Pages handlers | None |
| `012_freellm_runtime_state.sql` | D1-backed FreeLLM sessions, OAuth state, rate-limit counters | None |

FreeLLM's imported current schema is maintained in `apps/freellm/migrations/`; the root `002_freellm.sql` predates it and creates an incompatible `freellm_api_keys` table. Do not apply either schema chain to production until a read-only schema inventory and data-preserving migration plan resolve the conflict. Migration 012 is separate and has not been applied remotely.

Migration 008 was deleted with DevCheap. Migration 010 is idempotent: it uses `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `INSERT OR IGNORE`, so it can safely run against a database where some TRX tables already exist.

### Verify Remote Migrations

```bash
npx wrangler d1 execute hasit-in --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'core_%' OR name LIKE 'freellm_%' OR name LIKE 'fitness_%' OR name LIKE 'finance_%' OR name LIKE 'quiz_%' OR name LIKE 'blog_%' OR name LIKE 'games_%' OR name LIKE 'trx_%' OR name LIKE 'analytics_%') ORDER BY name;"
```

Do not run the remote command until the FreeLLM schema conflict is resolved through a read-only D1 inventory and an explicitly approved data-preserving migration plan.

---

## 🚀 Phase 3: Deployment Configuration

### Deployment Target: Cloudflare Worker

This project is a **Cloudflare Worker**, not Cloudflare Pages. `wrangler.toml` has `main = "src/index.ts"`, and the Worker owns the D1, Durable Object, route, and asset configuration. Interview remains a separate Cloudflare Pages SSR deployment.

Using `cloudflare/pages-action@v1` would have published the repository root as a static site with no Worker behind it. The deployment must use `wrangler deploy` or `cloudflare/wrangler-action@v3`.

The Worker configuration includes:

- One D1 binding (`DB`)
- The `AUTH_STATE` Durable Object binding and its `[[migrations]]` block
- The `RATE_LIMITER` Durable Object binding
- An `[assets]` block with `directory = "./public"` and `binding = "ASSETS"`
- `routes` entries using `custom_domain = true` for configured hostnames. `trx.hasit.in` and `blog.hasit.in` remain excluded pending route-ownership checks.
- A `[vars]` block for public environment configuration
- No request-path KV binding: the CoinGecko price cache uses the Cache API and isolate-level request coalescing.

### Static Assets

`npm run build:apps` builds FreeLLM, Games, and Fitness, and stages the available Finance and Quiz static files under `public/apps/`. Cloudflare serves those files through the `[assets]` binding, with the Worker redirecting each SPA host root to its app directory. FreeLLM API and `/v1` handlers are mounted in the Worker; its session, OAuth, and rate-limit state uses D1 rather than KV. The upstream business schema remains gated by the legacy migration conflict. Interview is intentionally excluded from Worker assets and remains Pages SSR with its Pages-local D1/password auth.

### DevCheap Removal

DevCheap has been removed from the monorepo and migration 008 has been deleted. The Worker no longer serves `devcheap.click`; DevCheap remains an external site that the portfolio links to.

### Environment-Driven Identifiers

`GA_ID` and `ADSENSE_CLIENT` live in `wrangler.toml` under `[vars]` and are read through `src/lib/site-config.ts`. Templates no longer hardcode those identifiers.

The old hardcoded template values included a typo'd GA4 ID, `G-NNFPYD7CWQ` instead of `G-NNFPYD7CWG`. That typo meant GA4 was receiving data for a non-existent property. `GOOGLE_CLIENT_SECRET` is a secret and must never be placed in `[vars]`.

### Required Worker Secrets

Set these with `wrangler secret put` before the first deploy:

```bash
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put FAUCETPAY_API_KEY
npx wrangler secret put JWT_PRIVATE_KEY
npx wrangler secret put JWT_PUBLIC_KEY
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put FREELLM_API_KEY
npx wrangler secret put ADMIN_PASSWORD   # Only needed until the first admin login
```

`GOOGLE_CLIENT_SECRET` must remain a Worker secret, not a `[vars]` entry.

`ADMIN_PASSWORD` bootstraps the admin panel on a database that has no admin password yet. The first successful login stores a PBKDF2 hash in `trx_settings`, after which the database is authoritative and the secret can be removed. Without it, a fresh deployment refuses admin logins rather than letting the first visitor claim the panel.

### Generate JWT Keys

```bash
openssl ecparam -name prime256v1 -genkey -noout -out private.pem
openssl ec -in private.pem -pubout -out public.pem

npx wrangler secret put JWT_PRIVATE_KEY < private.pem
npx wrangler secret put JWT_PUBLIC_KEY < public.pem
```

---

## 🧪 Phase 4: Local Development & Testing

### Start the Development Server

```bash
npm ci
npm run dev
```

`predev` runs `npm run check:config` before Wrangler starts.

### Local Routing

- `localhost` defaults to the TRX Faucet.
- The auth app is mounted at `/auth/*`, for example `http://localhost:8787/auth/health`.
- Other apps are reachable with the development-only `X-Hasit-Dev-App` header, for example `curl -H "X-Hasit-Dev-App: freellm" http://localhost:8787/`. Miniflare rewrites local request URLs to the first `custom_domain` route, so `Host` headers are not reliable in development; the override is ignored in production. `node scripts/smoke.js` exercises the whole matrix against a running `npm run dev`.

### Test Endpoints

| Endpoint | Method | Expected |
|----------|--------|----------|
| `http://localhost:8787/` | GET | TRX Faucet page |
| `http://localhost:8787/admin` | GET | Admin login |
| `http://localhost:8787/api/price` | GET | `{ usd, btc, usd_24h_change }` |
| `http://localhost:8787/api/stats` | GET | `{ totalClaims, totalUsers, totalPaid }` |
| `http://localhost:8787/health` | GET | `{ status: "ok", app: "trx-faucet" }` |
| `http://localhost:8787/auth/health` | GET | `{ status: "ok", service: "auth" }` |

### Test Claim Flow

1. Visit `/`.
2. Enter a valid TRX address (starts with `T`, 34 characters).
3. Complete the Turnstile captcha.
4. Play the memory game (match 6 pairs) - client-side only; it is not a server-side bot gate.
5. Click "Claim your TRX!".
6. Verify the success toast and redirect.

### Package Scripts

| Command | Behavior |
|---------|----------|
| `npm run dev` | Starts Wrangler; `predev` runs the config check |
| `npm run dev:keys` | Creates local development keys |
| `npm run deploy` | Deploys the Worker; `predeploy` runs config check, typecheck, and tests |
| `npm run deploy:dry` | Runs the config check and a Wrangler dry run |
| `npm run db:migrate` | Runs migrations against local D1 |
| `npm run db:migrate:local` | Runs migrations against local D1 |
| `npm run db:migrate:remote` | Runs migrations against remote D1 |
| `npm run check:config` | Checks configuration invariants |
| `npm run build:apps` | Builds and stages the available SPA assets |
| `npm run typecheck` | Runs TypeScript; `pretypecheck` runs the config check |
| `npm test` | Runs the Node built-in test runner; tests include cache, route, Games, Finance, and Quiz integration checks |
| `npm run lint` | Runs ESLint on `src/` |
| `npm run check` | Runs typecheck, tests, and the deployment dry run |

---

## 📋 Phase 5: CI/CD Pipeline

`.github/workflows/deploy.yml` is a Workers pipeline. It runs on pushes to `main` and on manual `workflow_dispatch` events, with `contents: read` permission.

### `deploy` Job

The deploy job runs on `ubuntu-latest` and executes these steps in order:

1. `actions/checkout@v4`
2. `actions/setup-node@v4` with Node 22 and the npm cache
3. `npm ci`
4. `npm run typecheck`
5. `npm test`
6. `npm run deploy:dry`
7. `cloudflare/wrangler-action` pinned to a commit SHA, with `command: deploy` and `wranglerVersion: 4.166.0`

Wrangler 4.166.0 and `@cloudflare/workers-types` 5.20261121.1 are pinned in `package.json` to the versions tested locally. The action receives `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from GitHub secrets.

### `migrate` Job

Migrations are a separate manual job. The job runs only when the event is `workflow_dispatch` and the `run_migrations` boolean input is `true`; the migration step has the same explicit guard.

A deploy must never be able to mutate the D1 schema, so a normal push to `main` can never run migrations.

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers, D1, and Durable Objects permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

---

## ✅ Phase 6: Verification Checklist

### Automated Checks

- [x] `npm run check:config` passes
- [x] Root `npm run typecheck` passes after current Worker integrations
- [x] Root `npm test` passes (49 tests after current integrations)
- [x] Root `npm run lint` passes
- [x] Games typecheck and production build pass
- [x] Fitness static export and typecheck pass
- [x] `npm run deploy:dry` succeeds after Finance/Quiz API integrations

### Manual Pre-Deployment Checks

- [ ] Verify `trx.hasit.in` and `blog.hasit.in` route ownership before adding them to `wrangler.toml`
- [ ] All required Worker secrets are set
- [ ] JWT keys are generated and set
- [ ] Google OAuth is configured (redirect URI: `https://auth.hasit.in/callback`)
- [ ] `npm run db:migrate:remote` completes successfully
- [ ] The first Worker deployment succeeds

### Post-Deployment Checks

- [ ] `https://trx.hasit.in` loads the faucet page
- [ ] `https://trx.hasit.in/admin` shows the login page
- [ ] `https://trx.hasit.in/api/price` returns JSON
- [ ] `https://auth.hasit.in/health` returns OK
- [ ] Claim flow works end-to-end
- [ ] Admin login works
- [ ] Referral links work (`?r=ADDRESS`)
- [ ] Price ticker updates
- [ ] Dark/light theme toggles
- [ ] All configured subdomains resolve

### Subdomain Verification

| Host | Expected Response |
|------|-------------------|
| `hasit.in` | Portfolio HTML |
| `www.hasit.in` | Portfolio HTML |
| `trx.hasit.in` | HTML faucet page (after route-ownership check) |
| `trx2.hasit.in` | HTML faucet page |
| `freellm.hasit.in` | FreeLLM SPA; `/api/*` and `/v1/*` use mounted Worker handlers |
| `fitness.hasit.in` | Fitness static app |
| `finance.hasit.in` | Finance static app and API |
| `blog.hasit.in` | `{ "name": "Blog", "status": "coming soon" }` |
| `quiz.hasit.in` | Quiz static app and AI proxy |
| `games.hasit.in` | Games static app and API |
| `auth.hasit.in/health` | `{ "status": "ok", "service": "auth" }` |

---

## 🐛 Known Issues & Workarounds

| Issue | Workaround |
|-------|------------|
| D1 100MB limit | Monitor size; archive old claim logs |
| Cloudflare KV limit | No request-path KV reads/writes remain; keep the 1,000 calls/day cap as a constraint for future changes |
| Turnstile localhost | Use `localhost` in the Turnstile dashboard |
| Google OAuth localhost | Add `http://localhost:8787` to authorized redirect URIs |
| ES256 key format | Must be PKCS8 (private) / SPKI (public) PEM |
| Existing Pages custom domains | If the old Pages project still owns any `*.hasit.in` domain, remove or transfer it before deploying Worker routes, or route creation will conflict |

---

## 📝 Remaining Manual Steps

1. Verify ownership and route availability for `trx.hasit.in` and `blog.hasit.in`.
2. Reconcile the legacy root FreeLLM schema with the imported upstream migration chain; inspect the actual D1 schema read-only and prepare a data-preserving migration plan before any D1 changes.
3. Keep Interview on Pages with its planned Pages-local D1/password auth; add a shared Worker API only if an explicit plan specifies one.
4. Configure the required Worker secrets, including FreeLLM's `ENCRYPTION_KEY`, email/OAuth settings, `ADMIN_PASSWORD` on a fresh database, and `FREELLM_API_KEY` for AI features (Quiz, Finance, Games).
5. Review and apply production D1 migrations only after an explicit production change window.
6. Perform deployment, DNS cutover, and legacy-service retirement only after explicit approval.

---

## 🎯 Success Criteria

**Definition of Done**:

1. **Automated:** `npm run typecheck` passes with 0 errors, and `npm test` passes.
2. **Manual:** `npm run dev` starts the Worker on `localhost:8787` with the TRX Faucet as the default app.
3. **Manual:** All configured Hasit.in routes respond correctly.
4. **Manual:** The TRX faucet claim flow works end-to-end.
5. **Manual:** The admin panel is functional.
6. **Automated:** CI deploys the Cloudflare Worker on push to `main` after typecheck, tests, and a dry run.
7. **Manual:** Cloudflare secrets are configured, remote migrations are applied, and the first deploy is verified.

---

**Generated**: 2026-11-21
**For**: Implementation and production deployment
**Status**: Code checks pass; production setup remains manual
