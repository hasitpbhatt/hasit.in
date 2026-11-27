import { Hono } from 'hono';
import type { Env } from './env';

import { trxApp } from './apps/trx';
import { portfolioApp } from './apps/portfolio';
import { freellmApp } from './apps/freellm';
import { fitnessApp } from './apps/fitness';
import { blogApp } from './apps/blog';
import { authRoutes } from './lib/auth/routes';
import { isLocalHostname, resolveAppKey, resolveSpaAssetPaths, type AppKey } from './lib/host-routing';
import { securityHeadersMiddleware } from './middleware/security-headers';

type AppEnv = { Bindings: Env };

/** Hostname -> app. One Worker serves every subdomain. */
const APP_ROUTES: Record<string, Hono<AppEnv>> = {
  trx: trxApp,
  trx2: trxApp,
  freellm: freellmApp,
  fitness: fitnessApp,
  blog: blogApp,
  auth: authRoutes,
  '': portfolioApp,
};

const AUTH_PREFIX = '/auth';

function isPrivatePath(pathname: string): boolean {
  return pathname === '/apps'
    || pathname.startsWith('/apps/')
    || pathname === '/_spa'
    || pathname.startsWith('/_spa/');
}

function isApiPath(pathname: string): boolean {
  return pathname === '/health'
    || ['/api', '/v1', '/auth'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Create the main Hono app with security headers middleware
const app = new Hono<AppEnv>();

// Apply security headers to all responses
app.use('*', securityHeadersMiddleware());

app.all('*', async (c) => {
  const request = c.req.raw;
  const url = new URL(request.url);
  const env = c.env;

  if (isPrivatePath(url.pathname)) {
    return c.body(null, 404);
  }

  // Use Host header for routing when available (critical for local dev with custom Host headers)
  const hostHeader = request.headers.get('Host');
  const effectiveHostname = hostHeader ? hostHeader.toLowerCase() : url.hostname.toLowerCase();

  // Miniflare rewrites the request URL to the first custom_domain route when
  // running locally, so localhost needs an explicit app selector. In
  // production ENVIRONMENT is not "development" and this is always ignored.
  const devApp: AppKey | null =
    env.ENVIRONMENT === 'development'
      ? ((request.headers.get('X-Hasit-Dev-App') ?? 'trx') as AppKey)
      : null;
  const local = devApp !== null || isLocalHostname(effectiveHostname);

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
    return authRoutes.fetch(forwarded, env, c.executionCtx);
  }

  const appKey =
      devApp !== null && devApp in APP_ROUTES
        ? devApp
        : resolveAppKey(effectiveHostname, local);

  const pathname = url.pathname;

  const isPageRequest = request.method === 'GET' || request.method === 'HEAD';
  if (isPageRequest && !isApiPath(pathname)) {
    for (const assetPath of resolveSpaAssetPaths(appKey, pathname)) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = assetPath;
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

  const subApp = APP_ROUTES[appKey] ?? APP_ROUTES[''];

  // Request headers are immutable, so build a mutable copy first.
  const headers = new Headers(request.headers);
  headers.set('X-Hasit-Host', effectiveHostname);
  headers.set('X-Hasit-App', appKey);

  const appRequest = new Request(request, { headers });

  const response = await subApp.fetch(appRequest, env, c.executionCtx);

  // If the app returns 404, try serving from static Assets binding
  // (for custom domains where Assets binding isn't automatic).
  // Proxied apps own every path, so a 404 from them is authoritative.
  if (response.status === 404 && appKey !== 'fitness') {
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
});

export default app;

export { APP_ROUTES };
export { AuthState } from './lib/auth/auth-state';
export { RateLimiter } from './lib/rate-limiter';
