import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../../env';
import { verifyJWT, type HasitJWTPayload } from './jwt';

type AuthEnv = { Bindings: Env };

export function authMiddleware(expectedApp: string): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required', loginUrl: `https://auth.hasit.in/login/${expectedApp}` }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, c.env);

    if (!payload) {
      return c.json({ error: 'Invalid or expired token', loginUrl: `https://auth.hasit.in/login/${expectedApp}` }, 401);
    }

    if (payload.app !== expectedApp) {
      return c.json({ error: 'Token not valid for this app', loginUrl: `https://auth.hasit.in/login/${expectedApp}` }, 403);
    }

    c.set('user', payload);
    c.set('appName', expectedApp);
    await next();
  };
}

export function optionalAuthMiddleware(expectedApp: string): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyJWT(token, c.env);

      if (payload && payload.app === expectedApp) {
        c.set('user', payload);
        c.set('appName', expectedApp);
      }
    }

    await next();
  };
}

export function getUser(c: Context<AuthEnv>): HasitJWTPayload {
  const user = c.get('user');
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

export function getAppName(c: Context<AuthEnv>): string {
  return c.get('appName') || 'unknown';
}
