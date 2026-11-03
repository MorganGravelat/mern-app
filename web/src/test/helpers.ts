import { vi } from 'vitest'
import type { Session, User } from '../api'
import type { WorkOrder } from '../workOrders/types'

export const fakeWorkOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  _id: '65f0000000000000000000a1',
  orderNumber: 'WO-1001',
  title: 'Printer offline',
  description: 'Front desk printer does not respond.',
  customerName: 'Lakeside Dental',
  location: '1200 Lake Ave',
  category: 'hardware',
  priority: 'medium',
  status: 'pending',
  checklist: [],
  createdBy: { _id: 'u-dispatcher', firstName: 'Dana', lastName: 'Chen' },
  assignedTo: null,
  dueDate: '2026-12-15T00:00:00.000Z',
  completedAt: null,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...overrides,
})

export const fakeUser: User = {
  _id: '65f000000000000000000001',
  firstName: 'Jamie',
  lastName: 'Rivera',
  login: 'jrivera',
  email: 'jamie@example.com',
  role: 'technician',
  skills: [],
  phone: '',
  isAvailable: true,
  emailVerified: true,
  createdAt: '2026-10-01T00:00:00.000Z',
}

export function fakeSession(token = 'access-1', role: User['role'] = 'technician'): Session {
  return { accessToken: token, refreshToken: `refresh-for-${token}`, user: { ...fakeUser, role } }
}

export function jsonResponse(status: number, body?: unknown): Response {
  if (status === 204) return new Response(null, { status })
  return new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } })
}

export function apiError(status: number, code: string, message: string, details?: unknown): Response {
  return jsonResponse(status, { error: { code, message, details } })
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

// Replaces global fetch. The handler gets the path (without the host) and the request init.
export function mockFetch(handler: Handler) {
  const fn = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input)).pathname + new URL(String(input)).search
    return Promise.resolve(handler(path, init))
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization
}

// Builds a fetch handler from a table like { 'GET /api/workorders': (init) => jsonResponse(...) }.
// Any request that is not in the table fails the test with a clear message.
export function routes(table: Record<string, (init: RequestInit) => Response>) {
  return (path: string, init: RequestInit): Response => {
    const key = `${init.method ?? 'GET'} ${path}`
    const handler = table[key]
    return handler ? handler(init) : apiError(404, 'NOT_FOUND', `No mock for ${key}`)
  }
}

export function requestBody(init: RequestInit): unknown {
  return JSON.parse(String(init.body))
}
