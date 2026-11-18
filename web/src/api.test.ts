import { describe, expect, it } from 'vitest'
import { ApiError, apiRequest, errorText } from './api'
import { apiError, authHeader, jsonResponse, mockFetch } from './test/helpers'

// Runs a request that should fail and hands back the ApiError it threw.
async function failure(request: Promise<unknown>): Promise<ApiError> {
  const error = await request.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

describe('apiRequest', () => {
  it('sends JSON and the bearer token, and returns the parsed body', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { ok: true }))
    const result = await apiRequest('/api/things', { method: 'POST', body: { a: 1 }, token: 'abc' })
    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('http://localhost:5000/api/things')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('{"a":1}')
    expect(authHeader(init as RequestInit)).toBe('Bearer abc')
  })

  it('does not try to parse the empty body of a 204 response', async () => {
    mockFetch(() => jsonResponse(204))
    await expect(apiRequest('/api/auth/logout', { method: 'POST', token: 'abc' })).resolves.toBeUndefined()
  })

  it('turns the API error shape into an ApiError', async () => {
    mockFetch(() => apiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in'))
    const error = await failure(apiRequest('/api/auth/login', { method: 'POST', body: {} }))
    expect(error.status).toBe(403)
    expect(error.code).toBe('EMAIL_NOT_VERIFIED')
    expect(error.message).toBe('Verify your email before logging in')
  })

  it('reports an unreachable server as NETWORK_ERROR', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const error = await failure(apiRequest('/api/health'))
    expect(error.code).toBe('NETWORK_ERROR')
  })
})

describe('errorText', () => {
  it('adds the field messages from validation errors', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', [
      { field: 'password', message: 'Password must contain a number' },
    ])
    expect(errorText(error)).toBe('Some fields are missing or invalid: Password must contain a number')
  })

  it('hides unknown error details from the screen', () => {
    expect(errorText(new Error('secret stack info'))).toBe('Something went wrong. Please try again.')
  })
})
