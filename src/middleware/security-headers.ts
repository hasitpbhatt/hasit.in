import type { MiddlewareHandler } from 'hono';
import type { Env } from '../env';

type AppEnv = { Bindings: Env };

/**
 * Security headers middleware
 * Adds CSP, HSTS, frame-ancestors, Permissions-Policy and other security headers
 */
export function securityHeadersMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    const headers = c.res.headers;

    // Content Security Policy
    // Allows scripts/styles from self, CDNs used by apps, and Google services
    headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com https://pagead2.googlesyndication.com https://www.googletagmanager.com https://www.google-analytics.com https://apis.google.com https://accounts.google.com",
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
        "img-src 'self' data: blob: https://raw.githubusercontent.com https://cdnjs.cloudflare.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://*.googleusercontent.com",
        "connect-src 'self' https://freellm.hasit.in https://api.hasit.in https://auth.hasit.in https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com https://generativelanguage.googleapis.com https://*.googleapis.com wss://*.googleapis.com",
        "frame-src 'self' https://www.google.com https://accounts.google.com https://www.youtube.com https://tpc.googlesyndication.com",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ].join('; ')
    );

    // Strict Transport Security (HSTS) - 1 year, include subdomains, preload
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Prevent clickjacking
    headers.set('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    headers.set('X-Content-Type-Options', 'nosniff');

    // Referrer Policy
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (Feature Policy)
    headers.set(
      'Permissions-Policy',
      [
        'accelerometer=()',
        'ambient-light-sensor=()',
        'autoplay=(self)',
        'battery=()',
        'camera=()',
        'cross-origin-isolated=()',
        'display-capture=()',
        'document-domain=()',
        'encrypted-media=(self)',
        'execution-while-not-rendered=()',
        'execution-while-out-of-viewport=()',
        'fullscreen=(self)',
        'gamepad=()',
        'geolocation=()',
        'gyroscope=()',
        'hid=()',
        'identity-credentials-get=()',
        'idle-detection=()',
        'local-fonts=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'otp-credentials=()',
        'payment=(self)',
        'picture-in-picture=()',
        'publickey-credentials-create=()',
        'publickey-credentials-get=()',
        'screen-wake-lock=()',
        'serial=()',
        'speaker-selection=()',
        'storage-access=()',
        'usb=()',
        'web-share=(self)',
        'window-management=()',
        'xr-spatial-tracking=()',
      ].join(', ')
    );

    // Cross-Origin Embedder Policy
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

    // Cross-Origin Opener Policy
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');

    // Cross-Origin Resource Policy
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');

    // DNS Prefetch Control
    headers.set('X-DNS-Prefetch-Control', 'off');

    // Remove server header
    headers.delete('Server');
  };
}