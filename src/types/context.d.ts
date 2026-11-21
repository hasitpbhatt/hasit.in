import type { HasitJWTPayload } from '../lib/auth/jwt';

/**
 * Variables every Hono context in this Worker can carry.
 *
 * Declared once here so middleware can use `c.set(...)` without falling back
 * to `any`.
 */
declare module 'hono' {
  interface ContextVariableMap {
    /** Verified user payload, set by authMiddleware. */
    user: HasitJWTPayload;
    /** App the request was authenticated against. */
    appName: string;
    /** Client IP resolved from proxy headers. */
    clientIP: string;
    /** Authenticated admin user id. */
    adminUserId: number;
    /** CSRF token bound to the current admin session. */
    adminCsrf: string;
  }
}
