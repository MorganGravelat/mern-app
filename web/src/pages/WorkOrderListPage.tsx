import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Field } from '../components/Field'
import { PriorityBadge } from '../components/PriorityBadge'
import { SelectField } from '../components/SelectField'
import { StatusBadge } from '../components/StatusBadge'
import { useApiData } from '../hooks/useApiData'
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  formatShortDate,
  isStaff,
  personName,
  type WorkOrder,
} from '../workOrders/types'

const noFilters = { q: '', status: '', priority: '' }

export function WorkOrderListPage() {
  const { user } = useAuth()
  // "draft" is what is typed in the form; "applied" is what the list was last loaded with.
  const [draft, setDraft] = useState(noFilters)
  const [applied, setApplied] = useState(noFilters)

  const query = new URLSearchParams()
  if (applied.q) query.set('q', applied.q)
  if (applied.status) query.set('status', applied.status)
  if (applied.priority) query.set('priority', applied.priority)
  const queryText = query.toString()

  const { data, error, loading } = useApiData<{ workOrders: WorkOrder[] }>(
    `/api/workorders${queryText ? `?${queryText}` : ''}`,
  )

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    setApplied({ ...draft, q: draft.q.trim() })
  }

  function clearFilters() {
    setDraft(noFilters)
    setApplied(noFilters)
  }

  const workOrders = data?.workOrders ?? []
  const staff = user ? isStaff(user) : false

  return (
    <>
      <div className="toolbar page-head">
        <div>
          <p className="eyebrow">{staff ? 'WORKSPACE / DISPATCH' : 'WORKSPACE / MY JOBS'}</p>
          <h1>Work orders</h1>
          <p className="subtitle">
            {staff ? 'Create, assign, and track IT service requests.' : 'Your assigned IT service requests.'}
          </p>
        </div>
        {staff && (
          <Link to="/workorders/new" className="button">
            <span aria-hidden="true">+ </span>New work order
          </Link>
        )}
      </div>

      <form role="search" aria-label="Filter work orders" onSubmit={applyFilters} className="card filters">
        <Field label="Search" type="search" maxLength={100} placeholder="Title or order number" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
        <SelectField
          label="Status"
          emptyLabel="All statuses"
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <SelectField
          label="Priority"
          emptyLabel="All priorities"
          value={draft.priority}
          onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
          options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
        />
        <div className="actions">
          <button type="submit" className="secondary">
            Apply filters
          </button>
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      {loading && <p role="status">Loading work orders…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data && !loading && workOrders.length === 0 && (
        <p>{staff ? 'No work orders match.' : 'No work orders are assigned to you right now.'}</p>
      )}

      {workOrders.length > 0 && (
        <>
          <div className="list-summary">
            <span>
              {workOrders.length} work {workOrders.length === 1 ? 'order' : 'orders'}
            </span>
            {/* The API sorts by creation date, newest first (backend/src/routes/workorders.js). */}
            <span>Newest first</span>
          </div>
          <table className="order-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Assigned to</th>
                <th scope="col">Due</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((order) => (
                <tr key={order._id}>
                  <td data-label="Order">
                    <Link to={`/workorders/${order._id}`} className="order-link">
                      <span className="order-number">{order.orderNumber}</span>
                      <span className="sr-only">:</span>{' '}
                      <span className="order-title">{order.title}</span>
                    </Link>
                  </td>
                  <td data-label="Customer">{order.customerName || '—'}</td>
                  <td data-label="Status">
                    <StatusBadge status={order.status} />
                  </td>
                  <td data-label="Priority">
                    <PriorityBadge priority={order.priority} />
                  </td>
                  <td data-label="Assigned to">{personName(order.assignedTo)}</td>
                  <td data-label="Due">{formatShortDate(order.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
