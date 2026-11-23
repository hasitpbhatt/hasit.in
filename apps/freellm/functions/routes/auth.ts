// Auth: centralized auth.hasit.in handles OAuth, this module provides /api/me and /api/auth/logout
// using JWT validation from the centralized auth system.

import { Hono } from 'hono'
import type { Bindings, PublicUser, Variables } from '../lib/types'
import { centralAuthMiddleware, getCentralUser } from '../lib/middleware'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

import type { UserRow } from '../lib/types'

// Convert freellm UserRow to PublicUser format
const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  email: user.email,
  username: user.username,
  display_name: user.display_name,
  avatar_url: user.avatar_url,
  referral_code: user.referral_code,
  balance_credits: user.balance_credits,
  role: user.role,
  tier: user.tier,
  email_verified: user.email_verified,
  referred_by: user.referred_by,
  created_at: user.created_at,
  updated_at: user.updated_at,
})

// ------------------------------------------------------------------ me
// Uses centralized auth middleware to validate Bearer token
app.get('/api/me', centralAuthMiddleware, async (c) => {
  try {
    const user = getCentralUser(c)
    return c.json({ user: toPublicUser(user) })
  } catch {
    return c.json({ user: null })
  }
})

// ---------------------------------------------------------------- logout
// Centralized auth handles logout, but keep this for backward compatibility
app.post('/api/auth/logout', centralAuthMiddleware, async (c) => {
  // The frontend handles logout by clearing localStorage and redirecting to auth.hasit.in
  // This endpoint exists for API compatibility
  return c.json({ ok: true })
})

export default app
