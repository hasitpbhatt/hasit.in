import type { Env } from '../env.ts';

const DEFAULT_ORIGIN = 'https://fitness-8lk.pages.dev';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/** Headers the Worker adds for its own routing; the upstream must not see them. */
const INTERNAL = new Set(['host', 'x-hasit-host', 'x-hasit-app', 'x-hasit-dev-app']);

function copyHeaders(source: Headers, skip: Set<string>): Headers {
  const out = new Headers();
  source.forEach((value, key) => {
    const name = key.toLowerCase();
    if (HOP_BY_HOP.has(name) || skip.has(name)) return;
    out.append(key, value);
  });
  return out;
}

/**
 * fitness.hasit.in is served by the standalone hasitpbhatt/fitness Pages
 * project, not by this Worker. Its `functions/` layer already owns the API
 * surface, the SPA deep-link fallback and the asset routes, so this is a thin
 * pass-through: same method, same path, same body, same status.
 *
 * No header rewriting is needed for correctness. Every redirect upstream is
 * built from `env.PUBLIC_ORIGIN`, which already equals https://fitness.hasit.in,
 * and every cookie it issues is host-only (`Path=/`, no `Domain=`), so OAuth
 * round-trips and sessions survive the extra hop unchanged.
 */
export async function proxyFitness(request: Request, env: Env): Promise<Response> {
  const origin = env.FITNESS_ORIGIN || DEFAULT_ORIGIN;
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, origin);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  const upstream = await fetch(
    new Request(target.toString(), {
      method: request.method,
      headers: copyHeaders(request.headers, INTERNAL),
      body: hasBody ? request.body : undefined,
      // Upstream answers OAuth with 302s the browser must follow, not the Worker.
      redirect: 'manual',
    }),
  );

  // Body and framing are passed through untouched. The Workers runtime already
  // strips Content-Encoding/Content-Length when it decompresses a subrequest.
  const headers = copyHeaders(upstream.headers, new Set());

  // The upstream publishes its own CSP and Permissions-Policy (see its
  // public/_headers) but not HSTS, which this Worker serves on every host.
  if (!headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  headers.set('X-Hasit-App', 'fitness');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
