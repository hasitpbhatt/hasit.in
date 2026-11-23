import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from './authContext'
import type { User } from './types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoadingState] = useState(true)
  const [accessToken, setAccessTokenState] = useState<string | null>(() => {
    // Load token from localStorage on initial render
    if (typeof window !== 'undefined') {
      return localStorage.getItem('freellm_access_token')
    }
    return null
  })

  // Attach access token to API requests
    const makeAuthenticatedFetch = useCallback(
      (accessToken: string) => async (path: string, init?: RequestInit): Promise<unknown> => {
      if (!accessToken) {
        throw new Error('No access token')
      }
      const res = await fetch(`/api${path}`, {
        credentials: 'same-origin',
        ...init,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
      })
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
      if (!res.ok) {
        const err = new Error((body?.message as string) ?? res.statusText)
        ;(err as any).status = res.status
        ;(err as any).code = (body?.error as string) ?? 'unknown'
        throw err
      }
        return body
    },
      []
  )
    const authenticatedFetch = makeAuthenticatedFetch(accessToken)

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setUserState(null)
      setLoadingState(false)
      return
    }
    try {
          const data = await authenticatedFetch('/me') as { user: User | null }
      setUserState(data.user)
    } catch {
      setUserState(null)
    } finally {
      setLoadingState(false)
    }
  }, [accessToken, authenticatedFetch])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- session hydration on mount, synchronizing with an external system
    void refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try {
      await authenticatedFetch('/auth/logout', { method: 'POST' })
    } catch {
      // Ignore logout errors
    }
    setAccessTokenState(null)
    setUserState(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('freellm_access_token')
    }
  }, [authenticatedFetch])

  const setToken = useCallback(async (token: string) => {
    setAccessTokenState(token)
    if (typeof window !== 'undefined') {
      localStorage.setItem('freellm_access_token', token)
    }
    // Refresh user after setting token
    await refresh()
  }, [refresh])

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh, setToken }}>
      {children}
    </AuthContext.Provider>
  )
}
