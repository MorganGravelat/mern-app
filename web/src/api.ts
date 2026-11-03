// Small wrapper around fetch for talking to the Express API.
// Every API error looks like { error: { code, message, details? } }.

// Set VITE_API_BASE_URL in web/.env to point at a different API. Not a secret: it ships to the browser.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')

export type Role = 'admin' | 'dispatcher' | 'technician'

export interface User {
  _id: string
  firstName: string
  lastName: string
  login: string
  email: string
  role: Role
  skills: string[]
  phone: string
  isAvailable: boolean
  emailVerified: boolean
  createdAt: string
}

export interface Session {
  accessToken: string
  refreshToken: string
  user: User
}

interface FieldProblem {
  field: string
  message: string
}

export class ApiError extends Error {
  status: number
  code: string
  details: FieldProblem[]

  constructor(status: number, code: string, message: string, details: FieldProblem[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string // access token, sent as "Authorization: Bearer <token>"
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check that the API is running.')
  }

  // Logout answers 204 with an empty body, so there is no JSON to parse.
  if (response.status === 204) return undefined as T

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // leave data as null; handled below
  }

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string; details?: FieldProblem[] } } | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      error?.details ?? [],
    )
  }
  return data as T
}

// Turns any thrown value into text for the screen, including per-field validation messages.
export function errorText(err: unknown): string {
  if (err instanceof ApiError) {
    const problems = err.details.map((d) => d.message)
    return problems.length ? `${err.message}: ${problems.join('; ')}` : err.message
  }
  return 'Something went wrong. Please try again.'
}
