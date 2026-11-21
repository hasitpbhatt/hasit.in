/// <reference types="@cloudflare/workers-types" />

/**
 * Bindings and configuration available to the Worker.
 *
 * Public identifiers (GA4, AdSense, Turnstile site key, Google client id)
 * live in `wrangler.toml [vars]`. Real secrets are set with
 * `wrangler secret put` and must never appear in [vars].
 */
export interface Env {
  // Database
  DB: D1Database;

  // KV Namespaces
  KV: KVNamespace;

  // Durable Objects
  AUTH_STATE: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;

  // Secrets (set via wrangler secret put)
  TURNSTILE_SECRET: string;
  FAUCETPAY_API_KEY: string;
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  GOOGLE_CLIENT_SECRET: string;
  // Only needed until the admin password has been stored in trx_settings.
  ADMIN_PASSWORD?: string;

  // Local development only: "1" simulates FaucetPay payouts
  FAUCETPAY_MOCK?: string;

  // Variables (from wrangler.toml [vars])
  ENVIRONMENT: string;
  GA_ID: string;
  ADSENSE_CLIENT: string;
  TURNSTILE_SITE_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_REDIRECT_URI?: string;
}
