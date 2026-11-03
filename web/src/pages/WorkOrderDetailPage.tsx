import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorText } from '../api'
import { useAuth } from '../auth/useAuth'
import { AssignForm } from '../components/AssignForm'
import { PriorityBadge } from '../components/PriorityBadge'
import { StatusBadge } from '../components/StatusBadge'
import { useApiData } from '../hooks/useApiData'
import { CATEGORY_LABELS, PRIORITY_LABELS, formatDate, isFinalStatus, isStaff, personName, type WorkOrder } from '../workOrders/types'

type Confirming = 'cancel' | 'delete' | null

// Loads the work order, then hands it to WorkOrderDetail.
export function WorkOrderDetailPage() {
  const { id } = useParams()
  const { data, error, loading, setData } = useApiData<{ workOrder: WorkOrder }>(`/api/workorders/${id}`)

  if (data) return <WorkOrderDetail order={data.workOrder} onChange={(order) => setData({ workOrder: order })} />
  if (error) {
    return (
      <>
        <p role="alert" className="error">
          {error}
        </p>
        <Link to="/">Back to work orders</Link>
      </>
    )
  }
  return loading ? <p role="status">Loading work order…</p> : null
}

function WorkOrderDetail({ order, onChange }: { order: WorkOrder; onChange: (order: WorkOrder) => void }) {
  const { user, authedRequest } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [confirming, setConfirming] = useState<Confirming>(null)

  const staff = user ? isStaff(user) : false
  const final = isFinalStatus(order.status)
  const canTick = order.status === 'assigned' || order.status === 'in_progress'
  const doneCount = order.checklist.filter((item) => item.done).length
  const checklistDone = doneCount === order.checklist.length
  const assignedToMe = user !== null && order.assignedTo?._id === user._id

  // Sends a PATCH and shows the updated work order the API sends back.
  async function update(changes: object) {
    setBusy(true)
    setActionError('')
    try {
      const reply = await authedRequest<{ workOrder: WorkOrder }>(`/api/workorders/${order._id}`, {
        method: 'PATCH',
        body: changes,
      })
      onChange(reply.workOrder)
      setConfirming(null)
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setActionError('')
    try {
      await authedRequest(`/api/workorders/${order._id}`, { method: 'DELETE' })
      navigate('/', { replace: true })
    } catch (err) {
      setActionError(errorText(err))
      setBusy(false)
    }
  }

  function toggleTask(index: number) {
    const checklist = order.checklist.map((item, i) => (i === index ? { ...item, done: !item.done } : item))
    void update({ checklist })
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/">Work orders</Link> <span aria-hidden="true">/</span> <span aria-current="page">{order.orderNumber}</span>
      </nav>

      <div className="toolbar detail-head">
        <div>
          <h1>
            <span className="order-number">{order.orderNumber}</span>
            <span className="sr-only">:</span>{' '}
            <span className="detail-title">{order.title}</span>
          </h1>
          <p className="detail-sub">
            <StatusBadge status={order.status} /> <PriorityBadge priority={order.priority} />
          </p>
          <p className="subtitle">
            {order.customerName || 'No customer'} · {CATEGORY_LABELS[order.category]}
          </p>
        </div>
        <Link to="/" className="button secondary-link">
          <span aria-hidden="true">← </span>Back to work orders
        </Link>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <section aria-labelledby="description-heading" className="card">
            <h2 id="description-heading">Description</h2>
            <p>{order.description || 'No description.'}</p>
          </section>

          {assignedToMe && <p className="banner">Assigned to you</p>}

          <section aria-labelledby="checklist-heading" className="card">
            <div className="checklist-head">
              <h2 id="checklist-heading">Checklist</h2>
              {order.checklist.length > 0 && (
                <span className="hint">
                  {doneCount} of {order.checklist.length} complete
                </span>
              )}
            </div>
            {order.checklist.length === 0 && <p>No checklist items.</p>}
            {order.checklist.length > 0 && (
              <progress className="progress" max={order.checklist.length} value={doneCount} aria-label="Checklist progress" />
            )}
            <ul className="checklist">
              {order.checklist.map((item, index) => (
                <li key={`${index}-${item.task}`} className={item.done ? 'done' : undefined}>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.done}
                      disabled={!canTick || busy}
                      onChange={() => toggleTask(index)}
                    />
                    <span>{item.task}</span>
                  </label>
                </li>
              ))}
            </ul>
            {!canTick && !final && order.checklist.length > 0 && (
              <p className="hint">Tasks can be checked once the work order is assigned.</p>
            )}

            {actionError && (
              <p role="alert" className="error">
                {actionError}
              </p>
            )}

            <div className="actions">
              {order.status === 'assigned' && (
                <button type="button" disabled={busy} onClick={() => void update({ status: 'in_progress' })}>
                  Start work
                </button>
              )}
              {order.status === 'in_progress' && (
                <button type="button" disabled={busy || !checklistDone} onClick={() => void update({ status: 'completed' })}>
                  Mark complete
                </button>
              )}
              {staff && !final && (
                <Link to={`/workorders/${order._id}/edit`} className="button secondary-link">
                  Edit
                </Link>
              )}
              {order.status === 'in_progress' && !checklistDone && (
                <span className="hint">Finish all checklist items to complete this work order.</span>
              )}
            </div>
          </section>

      {staff && (
        <>
          <AssignForm order={order} busy={busy} onAssign={(technicianId) => void update({ assignedTo: technicianId })} />

          <section className="card" aria-labelledby="danger-heading">
            <h2 id="danger-heading">Cancel or delete</h2>
            {confirming === null && (
              <div className="actions">
                {!final && (
                  <button type="button" className="secondary" onClick={() => setConfirming('cancel')}>
                    Cancel work order
                  </button>
                )}
                <button type="button" className="danger" onClick={() => setConfirming('delete')}>
                  Delete work order
                </button>
              </div>
            )}
            {confirming === 'cancel' && (
              <div role="group" aria-label="Confirm cancel">
                <p>Cancel {order.orderNumber}? A cancelled work order cannot be changed again.</p>
                <div className="actions">
                  <button type="button" className="danger" disabled={busy} onClick={() => void update({ status: 'cancelled' })}>
                    Yes, cancel it
                  </button>
                  <button type="button" className="secondary" onClick={() => setConfirming(null)}>
                    Keep it
                  </button>
                </div>
              </div>
            )}
            {confirming === 'delete' && (
              <div role="group" aria-label="Confirm delete">
                <p>Delete {order.orderNumber} permanently? This cannot be undone.</p>
                <div className="actions">
                  <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>
                    Yes, delete it
                  </button>
                  <button type="button" className="secondary" onClick={() => setConfirming(null)}>
                    Keep it
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
        </div>

        <aside aria-labelledby="details-heading" className="card detail-side">
          <h2 id="details-heading">Work order details</h2>
          <dl className="details">
            <dt>Customer</dt>
            <dd>{order.customerName || '—'}</dd>
            <dt>Location</dt>
            <dd>{order.location || '—'}</dd>
            <dt>Category</dt>
            <dd>{CATEGORY_LABELS[order.category]}</dd>
            <dt>Priority</dt>
            <dd>{PRIORITY_LABELS[order.priority]}</dd>
            <dt>Assigned to</dt>
            <dd>{personName(order.assignedTo)}</dd>
            <dt>Due date</dt>
            <dd>{formatDate(order.dueDate)}</dd>
            <dt>Created by</dt>
            <dd>{personName(order.createdBy, 'Unknown')}</dd>
            {order.completedAt && (
              <>
                <dt>Completed</dt>
                <dd>{new Date(order.completedAt).toLocaleString()}</dd>
              </>
            )}
          </dl>
        </aside>
      </div>
    </>
  )
}
