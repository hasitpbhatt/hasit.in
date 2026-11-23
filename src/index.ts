import { Hono } from 'hono';
import type { Env } from './env';

import { trxApp } from './apps/trx';
import { portfolioApp } from './apps/portfolio';
import { freellmApp } from './apps/freellm';
import { fitnessApp } from './apps/fitness';
import { financeApp } from './apps/finance';
import { blogApp } from './apps/blog';
import { quizApp } from './apps/quiz';
import { gamesApp } from './apps/games';
import { authRoutes } from './lib/auth/routes';
import { getSpaAssetPath, isLocalHostname, resolveAppKey, type AppKey } from './lib/host-routing';

type AppEnv = { Bindings: Env };

/** Hostname -> app. One Worker serves every subdomain. */
const APP_ROUTES: Record<string, Hono<AppEnv>> = {
  trx: trxApp,
  trx2: trxApp,
  freellm: freellmApp,
  fitness: fitnessApp,
  finance: financeApp,
  blog: blogApp,
  quiz: quizApp,
  games: gamesApp,
  auth: authRoutes,
  '': portfolioApp,
};

const AUTH_PREFIX = '/auth';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    // Miniflare rewrites the request URL to the first custom_domain route when
    // running locally, so localhost needs an explicit app selector. In
    // production ENVIRONMENT is not "development" and this is always ignored.
    const devApp: AppKey | null =
      env.ENVIRONMENT === 'development'
        ? ((request.headers.get('X-Hasit-Dev-App') ?? 'trx') as AppKey)
        : null;
    const local = devApp !== null || isLocalHostname(hostname);

    // Locally the auth app is also reachable under /auth/* so a single origin
    // can exercise the whole surface (plan.md Phase 4 endpoint table).
    if (local && (url.pathname === AUTH_PREFIX || url.pathname.startsWith(`${AUTH_PREFIX}/`))) {
      const stripped = url.pathname.slice(AUTH_PREFIX.length) || '/';
      const target = new URL(stripped + url.search, url);
      const headers = new Headers(request.headers);
      headers.set('X-Hasit-App', 'auth');
      const forwarded = new Request(target, {
        method: request.method,
        headers,
        body: request.body,
      });
      return authRoutes.fetch(forwarded, env, ctx);
    }

    const appKey =
      devApp !== null && devApp in APP_ROUTES ? devApp : resolveAppKey(hostname, local);

    const spaAssetPath = getSpaAssetPath(appKey);

        // Handle SPA routes for subdomain apps - serve index.html at clean URLs
        // without exposing internal /apps/ prefix
        if (spaAssetPath) {
          const spaRoutes: Record<string, string[]> = {
            freellm: ['/chat', '/dashboard', '/earn', '/models', '/providers', '/developers', '/usage', '/keys', '/admin', '/login', '/register', '/verify-email'],
            fitness: ['/food', '/workouts', '/today', '/progress', '/quiz', '/login'],
            finance: ['/stocks', '/portfolio', '/watchlist'],
            quiz: ['/play', '/leaderboard', '/history'],
            games: ['/play', '/leaderboard', '/history'],
          };
          const routes = spaRoutes[appKey] ?? [];
          const isSpaRoute = url.pathname === '/' || routes.some((r) => url.pathname === r || url.pathname.startsWith(r + '/'));
          
          if (isSpaRoute) {
            // Request the SPA root path from Assets binding
            const assetUrl = new URL(request.url);
            assetUrl.pathname = spaAssetPath;
            const spaResponse = await env.ASSETS.fetch(new Request(assetUrl, request));
            if (spaResponse.status !== 404) {
              const responseHeaders = new Headers(spaResponse.headers);
              responseHeaders.set('X-Hasit-App', appKey);
              return new Response(spaResponse.body, {
                status: spaResponse.status,
                statusText: spaResponse.statusText,
                headers: responseHeaders,
              });
            }
          }
        }

        // Handle SPA deep links for prefixed paths (e.g., /apps/freellm/chat) - redirect to clean URL
        if (spaAssetPath && url.pathname.startsWith(spaAssetPath) && url.pathname !== spaAssetPath) {
          const cleanUrl = new URL(request.url);
          cleanUrl.pathname = url.pathname.replace(spaAssetPath, '/');
          return Response.redirect(cleanUrl, 302);
        }

    const app = APP_ROUTES[appKey] ?? APP_ROUTES[''];

    // Request headers are immutable, so build a mutable copy first.
    const headers = new Headers(request.headers);
    headers.set('X-Hasit-Host', hostname);
    headers.set('X-Hasit-App', appKey);

    const response = await app.fetch(new Request(request, { headers }), env, ctx);

        // If the app returns 404, try serving from static Assets binding
        // (for custom domains where Assets binding isn't automatic)
        if (response.status === 404) {
          const assetResponse = await env.ASSETS.fetch(request);
          if (assetResponse.status !== 404) {
            const responseHeaders = new Headers(assetResponse.headers);
            responseHeaders.set('X-Hasit-App', appKey);
            return new Response(assetResponse.body, {
              status: assetResponse.status,
              statusText: assetResponse.statusText,
              headers: responseHeaders,
            });
          }
        }

    response.headers.set('X-Hasit-App', appKey);
    return response;
  },
};

export { APP_ROUTES };
export { AuthState } from './lib/auth/auth-state';
export { RateLimiter } from './lib/rate-limiter';
