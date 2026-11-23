import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui'
import { GoogleButton } from '../components/GoogleButton'
import { useAuth } from '../lib/useAuth'

const AUTH_DOMAIN = 'https://auth.hasit.in'

/** Referral code stashed by the landing page before sign-in (may be absent). */
function stashedReferral(): string {
  try {
    return localStorage.getItem('freellm_ref') ?? ''
  } catch {
    // storage unavailable
    return ''
  }
}

export default function Login() {
  const { user, loading, setToken } = useAuth()
  const [searchParams] = useSearchParams()
  const [referred] = useState(() => stashedReferral() !== '')
  const [referral] = useState(stashedReferral)

  const redirectTo = searchParams.get('next') ?? '/dashboard'
  // OAuth failures come back as /login?error=… from the Google callback.
  const rawOAuthError = searchParams.get('error')
  let oauthError: string | null = null
  try {
    oauthError = rawOAuthError ? decodeURIComponent(rawOAuthError) : null
  } catch {
    oauthError = 'Unknown error'
  }

  // Handle OAuth callback: exchange code for access token
  useEffect(() => {
    const code = searchParams.get('code')
    const session = searchParams.get('session')
    
    if (code && session) {
      // Exchange the one-time code for an access token
      exchangeCode(code)
        .then(({ accessToken }) => {
          setToken(accessToken)
          // Clean up URL and redirect
          window.history.replaceState({}, '', redirectTo)
          window.location.href = redirectTo
        })
        .catch((err) => {
          console.error('OAuth exchange failed:', err)
          // Show error and let user retry
          window.history.replaceState({}, '', '/login?error=auth_failed')
          window.location.href = '/login?error=auth_failed'
        })
    }
  }, [searchParams, redirectTo, setToken])

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />
  }

  return (
    <div className="mx-auto max-w-sm py-12">
      <Card className="p-6">
        <h1 className="text-lg font-semibold">Sign in</h1>
        {referred && (
          <p className="mt-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            Referred by a friend — they earn 500,000 cr when you qualify (7-day streak or 200k Pool tokens). You get 50,000 cr on signup + milestones along the way.
          </p>
        )}
        <p className="mt-1 text-sm text-muted">
          One click with Google — new here? The same button creates your account. No passwords.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          {oauthError && (
            <p role="alert" className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
              Google sign-in failed: {oauthError}. Try again.
            </p>
          )}
          <GoogleButton next={redirectTo} referral={referral} />
        </div>
      </Card>
    </div>
  )
}

async function exchangeCode(code: string): Promise<{ accessToken: string; sessionId: string }> {
  const response = await fetch(`${AUTH_DOMAIN}/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ code }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Exchange failed' }))
    throw new Error(error.error || 'Exchange failed')
  }
  
  return response.json()
}
