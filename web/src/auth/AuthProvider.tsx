import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, apiRequest, type Session, type User } from '../api'
import { AuthContext, type AuthContextValue, type RequestOptions } from './useAuth'

// Tokens live only in memory (a ref), never in localStorage. Reloading the page
// ends the session, which is the trade-off we chose for the base version.
export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionRef = useRef<Session | null>(null)
  const refreshInFlight = useRef<Promise<string> | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [signedOutOnPurpose, setSignedOutOnPurpose] = useState(false)

  const saveSession = useCallback((session: Session | null) => {
    sessionRef.current = session
    setUser(session ? session.user : null)
    if (session) setSignedOutOnPurpose(false)
  }, [])

  const login = useCallback(
    async (loginName: string, password: string) => {
      const session = await apiRequest<Session>('/api/auth/login', {
        method: 'POST',
        body: { login: loginName, password },
      })
      saveSession(session)
    },
    [saveSession],
  )

  // Trades the refresh token for a new pair. On any failure the session is cleared,
  // so the user lands on the login page instead of looping.
  const refreshSession = useCallback((): Promise<string> => {
    if (refreshInFlight.current) return refreshInFlight.current
    const current = sessionRef.current
    if (!current) return Promise.reject(new ApiError(401, 'UNAUTHENTICATED', 'Please log in'))

    refreshInFlight.current = apiRequest<Session>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: current.refreshToken },
    })
      .then((session) => {
        saveSession(session)
        return session.accessToken
      })
      .catch((err) => {
        saveSession(null)
        throw err
      })
      .finally(() => {
        refreshInFlight.current = null
      })
    return refreshInFlight.current
  }, [saveSession])

  const authedRequest = useCallback(
    async <T,>(path: string, options: RequestOptions = {}): Promise<T> => {
      const current = sessionRef.current
      if (!current) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in')
      try {
        return await apiRequest<T>(path, { ...options, token: current.accessToken })
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 401) throw err
      }
      // The access token was rejected: refresh once and retry once. No further retries.
      const newToken = await refreshSession()
      try {
        return await apiRequest<T>(path, { ...options, token: newToken })
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) saveSession(null)
        throw err
      }
    },
    [refreshSession, saveSession],
  )

  const logout = useCallback(async () => {
    try {
      await authedRequest('/api/auth/logout', { method: 'POST' })
    } catch {
      // Even if the server can't be reached, forget the tokens on this device.
    }
    saveSession(null)
    setSignedOutOnPurpose(true)
  }, [authedRequest, saveSession])

  const value = useMemo<AuthContextValue>(
    () => ({ user, signedOutOnPurpose, login, logout, authedRequest }),
    [user, signedOutOnPurpose, login, logout, authedRequest],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
