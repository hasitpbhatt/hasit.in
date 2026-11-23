import type { Context, MiddlewareHandler } from 'hono';
import type { Env } from '../../env';
import { verifyJWT, type HasitJWTPayload } from './jwt';

// Define minimal bindings required for auth - just needs JWT keys
type AuthBindings = Pick<Env, 'JWT_PRIVATE_KEY' | 'JWT_PUBLIC_KEY'>;

// Generic type that works with any bindings extending AuthBindings
type AuthEnv<B extends AuthBindings> = { Bindings: B; Variables: { user?: HasitJWTPayload; appName?: string } };

export function authMiddleware<B extends AuthBindings>(expectedApp: string): MiddlewareHandler<AuthEnv<B>> {
  return async (c: Context<AuthEnv<B>>, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Authentication required', loginUrl: `https://auth.hasit.in/login/${expectedApp}` }, 401);
    }

    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, c.env as unknown as Env);

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

export function optionalAuthMiddleware<B extends AuthBindings>(expectedApp: string): MiddlewareHandler<AuthEnv<B>> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyJWT(token, c.env as unknown as Env);

      if (payload && payload.app === expectedApp) {
        c.set('user', payload);
        c.set('appName', expectedApp);
      }
    }

    await next();
  };
}

// Type for any context that has 'user' set with HasitJWTPayload - use any to accept various Hono context types
type UserContext = any;

export function getUser(c: UserContext): HasitJWTPayload {
  const user = c.get('user');
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

export function getAppName(c: UserContext): string {
  return c.get('appName') || 'unknown';
}
