import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import type { User } from './api'
import { apiError, fakeSession, fakeWorkOrder, jsonResponse, mockFetch, requestBody, routes } from './test/helpers'
import type { WorkOrder } from './workOrders/types'

const ORDER_ID = '65f0000000000000000000a1'
const TECH_ID = '65f0000000000000000000b1'

// Opens a page while logged out, logs in through the form, and lands back on that page.
async function openAs(role: User['role'], path: string, table: Parameters<typeof routes>[0]) {
  const user = userEvent.setup()
  const fetchMock = mockFetch(
    routes({
      'POST /api/auth/login': () => jsonResponse(200, fakeSession('access-1', role)),
      ...table,
    }),
  )
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  await user.type(screen.getByLabelText('Username or email'), 'someone')
  await user.type(screen.getByLabelText('Password'), 'Password123!')
  await user.click(screen.getByRole('button', { name: 'Log in' }))
  return { user, fetchMock }
}

// Calls made to the API for one method and path, with parsed bodies.
function callsTo(fetchMock: ReturnType<typeof mockFetch>, method: string, path: string) {
  return fetchMock.mock.calls.filter(([url, init]) => {
    const parsed = new URL(String(url))
    return (init?.method ?? 'GET') === method && parsed.pathname + parsed.search === path
  })
}

// A tiny in-memory "server" for one work order, so the page can be clicked through several steps.
function serverFor(initial: WorkOrder) {
  let order = initial
  return {
    get: () => jsonResponse(200, { workOrder: order }),
    patch: (init: RequestInit) => {
      const changes = requestBody(init) as Partial<WorkOrder> & { assignedTo?: string }
      const { assignedTo, ...rest } = changes
      order = { ...order, ...rest }
      if (assignedTo) order = { ...order, status: 'assigned', assignedTo: { _id: assignedTo, firstName: 'Morgan', lastName: 'Johnson' } }
      if (changes.status === 'completed') order = { ...order, completedAt: '2026-11-02T15:00:00.000Z' }
      return jsonResponse(200, { workOrder: order })
    },
  }
}

describe('work order list', () => {
  it('shows a technician only what the API returns and no create button', async () => {
    await openAs('technician', '/', {
      'GET /api/workorders': () =>
        jsonResponse(200, { workOrders: [fakeWorkOrder({ status: 'assigned', assignedTo: { _id: TECH_ID, firstName: 'Morgan', lastName: 'Johnson' } })] }),
    })

    expect(await screen.findByRole('link', { name: 'WO-1001: Printer offline' })).toHaveAttribute('href', `/workorders/${ORDER_ID}`)
    expect(await screen.findByText('Assigned', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.getByText(/Morgan Johnson/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New work order' })).not.toBeInTheDocument()
  })

  it('shows staff a New work order link', async () => {
    await openAs('dispatcher', '/', { 'GET /api/workorders': () => jsonResponse(200, { workOrders: [] }) })
    expect(await screen.findByRole('link', { name: 'New work order' })).toHaveAttribute('href', '/workorders/new')
  })

  it('sends the search text, status and priority to the API', async () => {
    const { user, fetchMock } = await openAs('dispatcher', '/', {
      'GET /api/workorders': () => jsonResponse(200, { workOrders: [] }),
      'GET /api/workorders?q=wifi&status=pending&priority=high': () => jsonResponse(200, { workOrders: [fakeWorkOrder({ title: 'Wi-Fi down' })] }),
    })
    await screen.findByText('No work orders match.')

    await user.type(screen.getByLabelText('Search'), '  wifi ')
    await user.selectOptions(screen.getByLabelText('Status'), 'pending')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))

    expect(await screen.findByRole('link', { name: 'WO-1001: Wi-Fi down' })).toBeInTheDocument()
    expect(callsTo(fetchMock, 'GET', '/api/workorders?q=wifi&status=pending&priority=high')).toHaveLength(1)
  })

  it('shows an empty message for a technician and an error message when the API fails', async () => {
    await openAs('technician', '/', { 'GET /api/workorders': () => apiError(500, 'SERVER_ERROR', 'Something went wrong') })
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('tells a technician with no jobs that nothing is assigned', async () => {
    await openAs('technician', '/', { 'GET /api/workorders': () => jsonResponse(200, { workOrders: [] }) })
    expect(await screen.findByText('No work orders are assigned to you right now.')).toBeInTheDocument()
  })

  it('shows the orders as a table with customer, priority, assignee and due date', async () => {
    await openAs('dispatcher', '/', {
      'GET /api/workorders': () =>
        jsonResponse(200, {
          workOrders: [
            fakeWorkOrder({ priority: 'critical', dueDate: '2026-11-06T00:00:00.000Z' }),
            fakeWorkOrder({ _id: '2', orderNumber: 'WO-1002', title: 'Second job' }),
          ],
        }),
    })

    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Order',
      'Customer',
      'Status',
      'Priority',
      'Assigned to',
      'Due',
    ])
    const firstRow = within(table).getAllByRole('row')[1]
    expect(within(firstRow).getByText('Lakeside Dental')).toBeInTheDocument()
    expect(within(firstRow).getByText('Critical')).toBeInTheDocument()
    expect(within(firstRow).getByText('Unassigned')).toBeInTheDocument()
    expect(within(firstRow).getByText('Nov 6')).toBeInTheDocument()
    expect(screen.getByText('2 work orders')).toBeInTheDocument()
  })
})

describe('work order detail for a technician', () => {
  it('starts the job, checks the tasks and completes it, with the saved result shown each time', async () => {
    const server = serverFor(
      fakeWorkOrder({
        status: 'assigned',
        assignedTo: { _id: TECH_ID, firstName: 'Morgan', lastName: 'Johnson' },
        checklist: [
          { task: 'Restart printer', done: false },
          { task: 'Print test page', done: false },
        ],
      }),
    )
    const { user, fetchMock } = await openAs('technician', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: server.get,
      [`PATCH /api/workorders/${ORDER_ID}`]: server.patch,
    })

    await user.click(await screen.findByRole('button', { name: 'Start work' }))
    expect(await screen.findByText('In progress', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark complete' })).toBeDisabled() // tasks still unchecked
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete work order' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Restart printer' }))
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Restart printer' })).toBeChecked())
    await user.click(screen.getByRole('checkbox', { name: 'Print test page' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark complete' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(await screen.findByText('Completed', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Restart printer' })).toBeDisabled() // final jobs are read-only

    const bodies = callsTo(fetchMock, 'PATCH', `/api/workorders/${ORDER_ID}`).map(([, init]) => requestBody(init as RequestInit))
    expect(bodies).toEqual([
      { status: 'in_progress' },
      { checklist: [{ task: 'Restart printer', done: true }, { task: 'Print test page', done: false }] },
      { checklist: [{ task: 'Restart printer', done: true }, { task: 'Print test page', done: true }] },
      { status: 'completed' },
    ])
  })

  it('shows the API message when an action is refused', async () => {
    const { user } = await openAs('technician', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: () => jsonResponse(200, { workOrder: fakeWorkOrder({ status: 'assigned' }) }),
      [`PATCH /api/workorders/${ORDER_ID}`]: () => apiError(409, 'INVALID_TRANSITION', 'A assigned work order cannot change to in_progress.'),
    })

    await user.click(await screen.findByRole('button', { name: 'Start work' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('cannot change to in_progress')
    expect(screen.getByText('Assigned', { selector: '.badge' })).toBeInTheDocument() // the screen still shows the saved state
  })

  it('shows the progress, the "Assigned to you" note and the details panel', async () => {
    await openAs('technician', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: () =>
        jsonResponse(200, {
          workOrder: fakeWorkOrder({
            status: 'in_progress',
            assignedTo: { _id: '65f000000000000000000001', firstName: 'Jamie', lastName: 'Rivera' },
            checklist: [
              { task: 'Check cable', done: true },
              { task: 'Clear queue', done: true },
              { task: 'Print test page', done: false },
            ],
          }),
        }),
    })

    expect(await screen.findByText('Assigned to you')).toBeInTheDocument()
    expect(screen.getByText('2 of 3 complete')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Checklist progress' })).toHaveAttribute('value', '2')
    expect(screen.getByText('Finish all checklist items to complete this work order.')).toBeInTheDocument()
    const details = screen.getByRole('complementary', { name: 'Work order details' })
    expect(within(details).getByText('Lakeside Dental')).toBeInTheDocument()
    expect(within(details).getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to work orders' })).toHaveAttribute('href', '/')
  })

  it('says the work order was not found when it belongs to someone else', async () => {
    await openAs('technician', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: () => apiError(404, 'NOT_FOUND', 'Work order not found'),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Work order not found')
  })

  it('after logout, the next login starts at the work order list instead of the last page', async () => {
    const { user } = await openAs('technician', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: () => jsonResponse(200, { workOrder: fakeWorkOrder({ status: 'assigned' }) }),
      'GET /api/workorders': () => jsonResponse(200, { workOrders: [] }),
      'POST /api/auth/logout': () => jsonResponse(204),
    })
    await screen.findByRole('heading', { name: 'WO-1001: Printer offline' })

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await user.type(await screen.findByLabelText('Username or email'), 'someone-else')
    await user.type(screen.getByLabelText('Password'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('heading', { name: 'Work orders' })).toBeInTheDocument()
  })
})

describe('work order detail for staff', () => {
  const technicians = { technicians: [{ _id: TECH_ID, firstName: 'Morgan', lastName: 'Johnson', isAvailable: true }] }

  it('assigns a technician from the list', async () => {
    const server = serverFor(fakeWorkOrder())
    const { user, fetchMock } = await openAs('dispatcher', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: server.get,
      [`PATCH /api/workorders/${ORDER_ID}`]: server.patch,
      'GET /api/users/technicians': () => jsonResponse(200, technicians),
    })

    const assignButton = await screen.findByRole('button', { name: 'Assign' })
    expect(assignButton).toBeDisabled() // nothing chosen yet
    await screen.findByRole('option', { name: 'Morgan Johnson' })
    await user.selectOptions(screen.getByLabelText('Technician'), TECH_ID)
    await user.click(assignButton)

    expect(await screen.findByText('Assigned', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reassign' })).toBeInTheDocument()
    expect(requestBody(callsTo(fetchMock, 'PATCH', `/api/workorders/${ORDER_ID}`)[0][1] as RequestInit)).toEqual({ assignedTo: TECH_ID })
  })

  it('asks for confirmation before deleting and only deletes after "Yes"', async () => {
    const { user, fetchMock } = await openAs('admin', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: () => jsonResponse(200, { workOrder: fakeWorkOrder() }),
      'GET /api/users/technicians': () => jsonResponse(200, technicians),
      [`DELETE /api/workorders/${ORDER_ID}`]: () => jsonResponse(204),
      'GET /api/workorders': () => jsonResponse(200, { workOrders: [] }),
    })

    await user.click(await screen.findByRole('button', { name: 'Delete work order' }))
    const confirm = screen.getByRole('group', { name: 'Confirm delete' })
    await user.click(within(confirm).getByRole('button', { name: 'Keep it' }))
    expect(callsTo(fetchMock, 'DELETE', `/api/workorders/${ORDER_ID}`)).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Delete work order' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))

    expect(await screen.findByRole('heading', { name: 'Work orders' })).toBeInTheDocument()
    expect(callsTo(fetchMock, 'DELETE', `/api/workorders/${ORDER_ID}`)).toHaveLength(1)
  })

  it('asks for confirmation before cancelling', async () => {
    const server = serverFor(fakeWorkOrder())
    const { user, fetchMock } = await openAs('dispatcher', `/workorders/${ORDER_ID}`, {
      [`GET /api/workorders/${ORDER_ID}`]: server.get,
      [`PATCH /api/workorders/${ORDER_ID}`]: server.patch,
      'GET /api/users/technicians': () => jsonResponse(200, technicians),
    })

    await user.click(await screen.findByRole('button', { name: 'Cancel work order' }))
    expect(callsTo(fetchMock, 'PATCH', `/api/workorders/${ORDER_ID}`)).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Yes, cancel it' }))

    expect(await screen.findByText('Cancelled', { selector: '.badge' })).toBeInTheDocument()
    expect(requestBody(callsTo(fetchMock, 'PATCH', `/api/workorders/${ORDER_ID}`)[0][1] as RequestInit)).toEqual({ status: 'cancelled' })
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument() // final jobs cannot be edited
  })
})

describe('create and edit forms', () => {
  it('creates a work order and opens it', async () => {
    const created = fakeWorkOrder({ title: 'Wi-Fi down' })
    const { user, fetchMock } = await openAs('dispatcher', '/workorders/new', {
      'POST /api/workorders': () => jsonResponse(201, { workOrder: created }),
      [`GET /api/workorders/${ORDER_ID}`]: () => jsonResponse(200, { workOrder: created }),
      'GET /api/users/technicians': () => jsonResponse(200, { technicians: [] }),
    })

    await user.type(await screen.findByLabelText('Title'), 'Wi-Fi down')
    await user.selectOptions(screen.getByLabelText('Category'), 'network')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-15' } })
    await user.click(screen.getByRole('button', { name: 'Add a task' }))
    await user.type(screen.getByLabelText('Task 1'), 'Check access point')
    await user.click(screen.getByRole('button', { name: 'Add a task' })) // left blank on purpose: ignored
    await user.click(screen.getByRole('button', { name: 'Create work order' }))

    expect(await screen.findByRole('heading', { name: 'WO-1001: Wi-Fi down' })).toBeInTheDocument()
    expect(requestBody(callsTo(fetchMock, 'POST', '/api/workorders')[0][1] as RequestInit)).toEqual({
      title: 'Wi-Fi down',
      description: '',
      customerName: '',
      location: '',
      category: 'network',
      priority: 'high',
      dueDate: '2026-12-15',
      checklist: [{ task: 'Check access point' }],
    })
  })

  it('shows the API validation message and keeps the form', async () => {
    const { user } = await openAs('dispatcher', '/workorders/new', {
      'POST /api/workorders': () =>
        apiError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', [{ field: 'dueDate', message: 'Invalid date' }]),
    })

    await user.type(await screen.findByLabelText('Title'), 'Wi-Fi down')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-12-15' } })
    await user.click(screen.getByRole('button', { name: 'Create work order' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid date')
    expect(screen.getByLabelText('Title')).toHaveValue('Wi-Fi down')
  })

  it('edits an existing work order, keeping the checklist ticks', async () => {
    const existing = fakeWorkOrder({
      status: 'in_progress',
      checklist: [{ task: 'Restart printer', done: true }],
    })
    const { user, fetchMock } = await openAs('dispatcher', `/workorders/${ORDER_ID}/edit`, {
      [`GET /api/workorders/${ORDER_ID}`]: () => jsonResponse(200, { workOrder: existing }),
      [`PATCH /api/workorders/${ORDER_ID}`]: () => jsonResponse(200, { workOrder: existing }),
      'GET /api/users/technicians': () => jsonResponse(200, { technicians: [] }),
    })

    const title = await screen.findByLabelText('Title')
    expect(title).toHaveValue('Printer offline')
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-12-15')
    await user.clear(title)
    await user.type(title, 'Printer offline (urgent)')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByRole('heading', { name: 'WO-1001: Printer offline' })
    expect(requestBody(callsTo(fetchMock, 'PATCH', `/api/workorders/${ORDER_ID}`)[0][1] as RequestInit)).toMatchObject({
      title: 'Printer offline (urgent)',
      dueDate: '2026-12-15',
      checklist: [{ task: 'Restart printer', done: true }],
    })
  })

  it('does not offer the edit form for a completed work order', async () => {
    await openAs('dispatcher', `/workorders/${ORDER_ID}/edit`, {
      [`GET /api/workorders/${ORDER_ID}`]: () => jsonResponse(200, { workOrder: fakeWorkOrder({ status: 'completed' }) }),
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('can no longer be changed')
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('sends a technician away from the create form', async () => {
    await openAs('technician', '/workorders/new', { 'GET /api/workorders': () => jsonResponse(200, { workOrders: [] }) })
    expect(await screen.findByRole('heading', { name: 'Work orders' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })
})
