import { createContext, useContext } from 'react'
import type { User } from '../api'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export interface AuthContextValue {
  user: User | null
  // True after the user pressed Log out, so the login page does not send the next person to the last page.
  signedOutOnPurpose: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => Promise<void>
  // Like apiRequest, but adds the access token and refreshes it once if it expired.
  authedRequest: <T = unknown>(path: string, options?: RequestOptions) => Promise<T>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
