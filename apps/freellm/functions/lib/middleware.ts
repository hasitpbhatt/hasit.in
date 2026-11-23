// Hono middleware: session resolution + role guards.

import { createMiddleware } from 'hono/factory'
import type { Bindings, UserRow, Variables } from './types'
import { getSession } from './session'
import { sha256Hex } from './crypto'
import { authMiddleware as centralAuthMiddlewareFactory } from '../../../../src/lib/auth/middleware'
import type { HasitJWTPayload } from '../../../../src/lib/auth/jwt'

type Env = { Bindings: Bindings; Variables: Variables }

async function loadUser(db: D1Database, userId: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM freellm_users WHERE id = ?').bind(userId).first<UserRow>()
}

/**
 * Resolves a `fl_…` API token (Bearer) to its user, refreshing last_used_at.
 * Returns null when the token is unknown or malformed.
 */
async function loadUserByApiToken(db: D1Database, token: string): Promise<UserRow | null> {
  const row = await db
    .prepare(
      `SELECT u.*, t.id AS token_id FROM freellm_api_tokens t JOIN freellm_users u ON u.id = t.user_id WHERE t.token_hash = ?`,
    )
    .bind(await sha256Hex(token))
    .first<UserRow & { token_id: string }>()
  if (!row) return null
  // Best-effort freshness marker; a stale write must not block the request.
  await db.prepare('UPDATE freellm_api_tokens SET last_used_at = ? WHERE id = ?').bind(Date.now(), row.token_id).run().catch(() => {})
  return row
}

/** 401s unless a valid session exists. */
export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const cookieHeader = c.req.header('cookie')
  const session = await getSession(c.env.freellm_sessions, cookieHeader)
  const user = session ? await loadUser(c.env.DB, session.userId) : null
  if (!user) {
    if (session) {
      const { sessionTokenFromCookies } = await import('./session')
      const token = sessionTokenFromCookies(cookieHeader)
      if (token) {
        const { sha256Hex: hash } = await import('./crypto')
        await c.env.freellm_sessions.delete(`sess:${await hash(token)}`).catch(() => {})
      }
    }
    return c.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401)
  }
  c.set('user', user)
  await next()
})

/** 403s unless the session user has the admin role (re-fetched, never stale). */
export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  const cached = c.get('user')
  if (!cached) return c.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401)
  const fresh = await loadUser(c.env.DB, cached.id)
  if (!fresh) return c.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401)
  if (fresh.role !== 'admin') {
    return c.json({ error: 'forbidden', message: 'Admin access required.' }, 403)
  }
  c.set('user', fresh)
  await next()
})

/**
 * Centralized auth middleware for freellm - wraps the centralized auth
 * and converts the payload to a freellm UserRow by looking up in freellm_users.
 * Uses JWT validation from auth.hasit.in.
 */
export const centralAuthMiddleware = createMiddleware<Env>(async (c, next) => {
  // First run the centralized auth middleware to validate the JWT
  const centralMiddleware = centralAuthMiddlewareFactory<Bindings>('freellm')
  await centralMiddleware(c as any, async () => {
    // Now we have the JWT payload in c.get('user')
    const jwtUser = c.get('user') as unknown as HasitJWTPayload | undefined
    if (!jwtUser) {
      c.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401)
      return
    }
    
    // Look up the user in freellm_users using the centralized user's sub (core_users ID)
    const user = await c.env.DB.prepare('SELECT * FROM freellm_users WHERE id = ?').bind(jwtUser.sub).first<UserRow>()
    if (!user) {
      c.json({ error: 'unauthorized', message: 'User not found in freellm system.' }, 401)
      return
    }
    c.set('user', user)
    await next()
  })
})

// Re-export for convenience
export { centralAuthMiddleware as authMiddleware }
export { getCentralUser as getUser }

/**
 * Get user from centralized auth - returns the freellm UserRow.
 * Must be called after centralAuthMiddleware has run.
 */
export const getCentralUser = (c: { get(key: string): unknown }): UserRow => {
  const user = c.get('user') as UserRow | undefined
  if (!user) throw new Error('User not set - centralAuthMiddleware must run first')
  return user
}

/**
 * Centralized auth admin middleware - checks admin role on the user
 * already set by centralAuthMiddleware.
 */
export const requireCentralAuthAdmin = createMiddleware<Env>(async (c, next) => {
  const user = c.get('user') as UserRow | undefined
  if (!user) return c.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401)
  if (user.role !== 'admin') {
    return c.json({ error: 'forbidden', message: 'Admin access required.' }, 403)
  }
  await next()
})

/**
 * 401s unless the request is authenticated by EITHER a session cookie OR an
 * `Authorization: Bearer fl_…` API token. Used by the /v1 OpenAI-compatible
 * surface; the native /api/* surface keeps cookie-only requireAuth.
 */
export const requireAuthOrToken = createMiddleware<Env>(async (c, next) => {
  const auth = c.req.header('Authorization') ?? ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (bearer) {
    if (!bearer.startsWith('fl_')) {
      return c.json({ error: 'unauthorized', message: 'That API token is not valid. Create one on /developers.' }, 401)
    }
    const user = await loadUserByApiToken(c.env.DB, bearer)
    if (!user) {
      return c.json({ error: 'unauthorized', message: 'That API token is not valid. Create one on /developers.' }, 401)
    }
    c.set('user', user)
    await next()
    return
  }
  const session = await getSession(c.env.freellm_sessions, c.req.header('cookie'))
  const user = session ? await loadUser(c.env.DB, session.userId) : null
  if (!user) return c.json({ error: 'unauthorized', message: 'Sign in to continue.' }, 401)
  c.set('user', user)
  await next()
})

/**
 * Wrapper for canAccessModel that works with centralized auth user.
 * The centralized user has 'tier' from freellm_users via the admin lookup,
 * but for non-admin users we default to 'free' tier.
 */
import { canAccessModel as coreCanAccessModel } from './tiers'

export function canAccessCentralUserModel(
  user: UserRow,
  model: { access_tier?: unknown }
): boolean {
  // For centralized auth users, we need to look up their tier from freellm_users
  // This is handled by requireCentralAuthAdmin which sets the full UserRow
  // For now, default to free tier (can be enhanced to fetch tier from DB)
  return coreCanAccessModel({ tier: user.tier, role: user.role }, model)
}
