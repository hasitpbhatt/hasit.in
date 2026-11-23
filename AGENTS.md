# AGENTS.md - Agent Guidance for hasit.in

This document provides guidance for AI agents working on the hasit.in codebase.

## Project Overview

hasit.in is a unified Cloudflare Worker that serves multiple subdomain applications:
- **trx.hasit.in** / **trx2.hasit.in** - TRX Faucet (crypto faucet with claims, admin, user pages)
- **freellm.hasit.in** - FreeLLM (AI chat interface with key vault, models, settings)
- **fitness.hasit.in** - Fitness tracker (workouts, food logging, progress, quizzes)
- **finance.hasit.in** - Finance tools (stock quotes, symbol search)
- **quiz.hasit.in** - MindVault (interactive quiz platform for learning)
- **games.hasit.in** - Games collection (2048, Snake, Wordle variants, etc.)
- **auth.hasit.in** - Authentication (Google OAuth, session management)
- **hasit.in** / **www.hasit.in** - Portfolio (main landing page)

## Architecture

- **Single Worker**: All subdomains served by one Cloudflare Worker (`src/index.ts`)
- **Hono Framework**: Each app is a Hono router mounted by hostname
- **Static Assets**: Served via Cloudflare Assets binding from `public/` and `public/_spa/`
- **D1 Database**: SQLite database for persistent data (users, claims, keys, etc.)
- **Durable Objects**: AuthState (sessions), RateLimiter (per-key rate limiting)

## Key Files

### Core
- `src/index.ts` - Main Worker entry point, hostname routing, security headers
- `src/env.ts` - Environment type definitions
- `wrangler.toml` - Cloudflare Worker configuration (routes, bindings, vars)

### Apps (src/apps/)
- `trx/` - TRX Faucet routes (claim, admin, api, user pages)
- `freellm/` - FreeLLM chat, key vault, models
- `fitness/` - Fitness tracking (Next.js static export)
- `finance/` - Stock quotes API
- `quiz/` - Quiz AI proxy (uses user's FreeLLM key)
- `games/` - Games collection (Vite + vanilla JS)
- `blog/` - Blog proxy to external VPS
- `portfolio/` - Main landing page

### Middleware (src/middleware/)
- `security.ts` - IP/Country/ASN bans, VPN/proxy detection
- `security-headers.ts` - CSP, HSTS, frame-ancestors, Permissions-Policy
- `session.ts` - JWT sessions, CSRF, flash messages

### Auth (src/lib/auth/)
- `jwt.ts` - ES256 JWT signing/verification with key derivation
- `routes.ts` - OAuth routes (Google, callback, logout)
- `auth-state.ts` - Durable Object for session state

### Database (src/lib/db/)
- `queries/` - Type-safe query helpers for each domain

## Build & Deploy

```bash
# Install dependencies
npm ci

# Type check
npm run typecheck

# Run tests
npm test

# Build all SPA apps (copies to public/_spa/)
npm run build:apps

# Dry-run deploy (typecheck + test + build + wrangler deploy --dry-run)
npm run deploy:dry

# Full deploy
npm run deploy
```

## Testing

- Tests are in `tests/*.test.ts`
- Run with `npm test` (uses Node.js native test runner)
- Tests cover: host routing, JWT, rate limiting, finance, quiz, games, security

## Security

- All responses include security headers (CSP, HSTS, frame-ancestors: none, Permissions-Policy)
- IP/Country/ASN ban lists loaded from D1 (trx_settings table)
- VPN/proxy detection via NastyHosts (cached 7 days)
- Rate limiting via Durable Object (fixed window)
- JWT ES256 with derived public key fallback
- CSRF protection on state-changing operations

## Adding a New Subdomain App

1. Create `src/apps/<name>/index.ts` exporting a Hono app
2. Add to `APP_ROUTES` in `src/index.ts`
3. Add route to `wrangler.toml` routes array
4. If SPA: add build step to `scripts/build-apps.js`
5. Update sitemap generation in `scripts/build-apps.js`
6. Add tests in `tests/`

## Environment Variables (wrangler.toml [vars])

- `ENVIRONMENT` - "production" or "development"
- `GA_ID` - Google Analytics measurement ID
- `ADSENSE_CLIENT` - AdSense publisher ID
- `TURNSTILE_SITE_KEY` - Turnstile site key for bot protection
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI

## Secrets (set via `wrangler secret put`)

- `TURNSTILE_SECRET` - Turnstile secret key
- `FAUCETPAY_API_KEY` - FaucetPay API key for payouts
- `JWT_PRIVATE_KEY` - ES256 PEM private key
- `JWT_PUBLIC_KEY` - ES256 PEM public key (optional, derived if missing)
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `FREELLM_API_KEY` - Default FreeLLM API key (Gemini)
- `FREELLM_MODEL` - Default model (gemini-2.5-flash)
- `ENCRYPTION_KEY` - FreeLLM key-vault encryption key
- `RESEND_API_KEY` - FreeLLM email verification

## Common Patterns

### Database Queries
Use the query helpers in `src/lib/db/queries/` for type-safe database access.

### Adding Routes
Each app uses Hono. Mount at root in `src/apps/<name>/index.ts`.

### Static Assets
Place in `public/` for root domain or `public/_spa/<app>/` for subdomain SPAs.

### Authentication
Use `authMiddleware(appName)` from `src/lib/auth` to protect routes.

## CI/CD

- `.github/workflows/deploy.yml` - Deploys on push to main
- `.github/workflows/pr-gate.yml` - Runs typecheck, test, deploy:dry on PRs
- Migrations are manual (workflow_dispatch with run_migrations=true)

## Troubleshooting

### Type Errors
Run `npm run typecheck` to see full TypeScript errors.

### Build Failures
Check `scripts/build-apps.js` for app-specific build commands.

### Deploy Issues
Run `npm run deploy:dry` to validate before deploying.

### Local Development
```bash
npm run dev:keys  # Generate local JWT keys
npm run dev       # Start wrangler dev server
```

## Code Style

- TypeScript strict mode
- ESLint with @typescript-eslint
- No unused variables (warning)
- Prefer explicit types over `any`

## Performance Notes

- Static assets served free via Cloudflare Assets (no Worker invocation)
- SPA apps in `public/_spa/` with `run_worker_first` for API routes
- D1 queries use prepared statements
- Rate limiter uses Durable Object for distributed counting
- Security settings cached 5 minutes

---

*This file helps AI agents understand the codebase structure and conventions.*