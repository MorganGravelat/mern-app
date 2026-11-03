import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import { apiError, authHeader, fakeSession, fakeUser, jsonResponse, mockFetch } from '../test/helpers'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

async function loggedInHook() {
  const hook = renderHook(() => useAuth(), { wrapper })
  await act(() => hook.result.current.login('jrivera', 'Password123!'))
  return hook
}

// Calls /me inside act and returns the error, so React finishes updating state before we look at it.
async function failingRequest(hook: Awaited<ReturnType<typeof loggedInHook>>) {
  let caught: unknown
  await act(async () => {
    caught = await hook.result.current.authedRequest('/api/auth/me').catch((err: unknown) => err)
  })
  return caught
}

describe('AuthProvider', () => {
  it('keeps the user from a successful login', async () => {
    mockFetch(() => jsonResponse(200, fakeSession()))
    const { result } = await loggedInHook()
    expect(result.current.user?.login).toBe('jrivera')
  })

  it('does not log in when the API says the email is not verified', async () => {
    mockFetch(() => apiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in'))
    const { result } = renderHook(() => useAuth(), { wrapper })
    await expect(act(() => result.current.login('jrivera', 'Password123!'))).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    })
    expect(result.current.user).toBeNull()
  })

  it('refreshes the token once when the access token is rejected, then retries once', async () => {
    let meCalls = 0
    const fetchMock = mockFetch((path, init) => {
      if (path === '/api/auth/login') return jsonResponse(200, fakeSession('old'))
      if (path === '/api/auth/refresh') return jsonResponse(200, fakeSession('new'))
      meCalls += 1
      return authHeader(init) === 'Bearer new'
        ? jsonResponse(200, { user: fakeUser })
        : apiError(401, 'INVALID_TOKEN', 'Access token is invalid or expired')
    })
    const { result } = await loggedInHook()

    const reply = await act(() => result.current.authedRequest<{ user: typeof fakeUser }>('/api/auth/me'))

    expect(reply.user.login).toBe('jrivera')
    expect(meCalls).toBe(2) // first try with the old token, one retry with the new token
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/refresh'))).toHaveLength(1)
  })

  it('stops after one refresh and one retry when the server keeps saying 401', async () => {
    const fetchMock = mockFetch((path) => {
      if (path === '/api/auth/login') return jsonResponse(200, fakeSession('old'))
      if (path === '/api/auth/refresh') return jsonResponse(200, fakeSession('new'))
      return apiError(401, 'INVALID_TOKEN', 'Access token has been revoked')
    })
    const hook = await loggedInHook()

    expect(await failingRequest(hook)).toMatchObject({ status: 401 })

    // login + me + refresh + me retry = 4 calls, never more
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(hook.result.current.user).toBeNull()
  })

  it('clears the session when the refresh itself fails', async () => {
    mockFetch((path) => {
      if (path === '/api/auth/login') return jsonResponse(200, fakeSession('old'))
      if (path === '/api/auth/refresh') return apiError(401, 'INVALID_TOKEN', 'Refresh token has been revoked')
      return apiError(401, 'INVALID_TOKEN', 'Access token is invalid or expired')
    })
    const hook = await loggedInHook()

    expect(await failingRequest(hook)).toMatchObject({ status: 401 })
    expect(hook.result.current.user).toBeNull()
  })

  it('logs out on a 204 response and forgets the user', async () => {
    const fetchMock = mockFetch((path) =>
      path === '/api/auth/login' ? jsonResponse(200, fakeSession()) : jsonResponse(204),
    )
    const { result } = await loggedInHook()

    await act(() => result.current.logout())

    expect(result.current.user).toBeNull()
    const [url, init] = fetchMock.mock.calls[1]
    expect(String(url)).toContain('/api/auth/logout')
    expect(authHeader(init as RequestInit)).toBe('Bearer access-1')
  })
})
