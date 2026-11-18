import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorText } from '../api'
import { useAuth } from '../auth/useAuth'
import { Field } from '../components/Field'
import { SelectField } from '../components/SelectField'
import { useApiData } from '../hooks/useApiData'
import {
  CATEGORIES,
  PRIORITIES,
  dateInputValue,
  isFinalStatus,
  type Category,
  type ChecklistItem,
  type Priority,
  type WorkOrder,
} from '../workOrders/types'

interface FormValues {
  title: string
  description: string
  customerName: string
  location: string
  category: Category
  priority: Priority
  dueDate: string
  checklist: ChecklistItem[]
}

const emptyForm: FormValues = {
  title: '',
  description: '',
  customerName: '',
  location: '',
  category: 'hardware',
  priority: 'medium',
  dueDate: '',
  checklist: [],
}

function valuesFromOrder(order: WorkOrder): FormValues {
  return {
    title: order.title,
    description: order.description,
    customerName: order.customerName,
    location: order.location,
    category: order.category,
    priority: order.priority,
    dueDate: dateInputValue(order.dueDate),
    checklist: order.checklist,
  }
}

// One page for both "New work order" (/workorders/new) and "Edit" (/workorders/:id/edit).
export function WorkOrderFormPage() {
  const { id } = useParams()
  const { data, error, loading } = useApiData<{ workOrder: WorkOrder }>(id ? `/api/workorders/${id}` : null)

  if (!id) return <WorkOrderForm initial={emptyForm} />
  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    )
  }
  if (loading || !data) return <p role="status">Loading work order…</p>
  if (isFinalStatus(data.workOrder.status)) {
    return (
      <>
        <p role="alert" className="error">
          A {data.workOrder.status} work order can no longer be changed.
        </p>
        <Link to={`/workorders/${id}`}>Back to the work order</Link>
      </>
    )
  }
  return <WorkOrderForm initial={valuesFromOrder(data.workOrder)} editingId={id} />
}

function WorkOrderForm({ initial, editingId }: { initial: FormValues; editingId?: string }) {
  const { authedRequest } = useAuth()
  const navigate = useNavigate()
  const [values, setValues] = useState<FormValues>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function setField<K extends keyof FormValues>(name: K, value: FormValues[K]) {
    setValues((old) => ({ ...old, [name]: value }))
  }

  function setTask(index: number, task: string) {
    setField(
      'checklist',
      values.checklist.map((item, i) => (i === index ? { ...item, task } : item)),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    // Blank task boxes are ignored. When editing, tasks keep their "done" tick.
    const checklist = values.checklist.filter((item) => item.task.trim() !== '')
    try {
      if (editingId) {
        await authedRequest(`/api/workorders/${editingId}`, { method: 'PATCH', body: { ...values, checklist } })
        navigate(`/workorders/${editingId}`)
      } else {
        const created = await authedRequest<{ workOrder: WorkOrder }>('/api/workorders', {
          method: 'POST',
          body: { ...values, checklist: checklist.map((item) => ({ task: item.task })) },
        })
        navigate(`/workorders/${created.workOrder._id}`)
      }
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <>
      <h1>{editingId ? 'Edit work order' : 'New work order'}</h1>
      <form onSubmit={handleSubmit} className="card">
        <Field label="Title" value={values.title} onChange={(e) => setField('title', e.target.value)} required maxLength={120} />
        <div className="field">
          <label htmlFor="field-description">Description</label>
          <textarea
            id="field-description"
            rows={4}
            maxLength={2000}
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </div>
        <Field label="Customer name" value={values.customerName} onChange={(e) => setField('customerName', e.target.value)} maxLength={100} />
        <Field label="Location" value={values.location} onChange={(e) => setField('location', e.target.value)} maxLength={200} />
        <SelectField
          label="Category"
          value={values.category}
          onChange={(e) => setField('category', e.target.value as Category)}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <SelectField
          label="Priority"
          value={values.priority}
          onChange={(e) => setField('priority', e.target.value as Priority)}
          options={PRIORITIES.map((p) => ({ value: p, label: p }))}
        />
        <Field label="Due date" type="date" value={values.dueDate} onChange={(e) => setField('dueDate', e.target.value)} required />

        <fieldset className="checklist-editor">
          <legend>Checklist</legend>
          {values.checklist.map((item, index) => (
            <div key={index} className="task-row">
              <Field label={`Task ${index + 1}`} value={item.task} onChange={(e) => setTask(index, e.target.value)} maxLength={200} />
              <button
                type="button"
                className="secondary"
                aria-label={`Remove task ${index + 1}`}
                onClick={() => setField('checklist', values.checklist.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() => setField('checklist', [...values.checklist, { task: '', done: false }])}
          >
            Add a task
          </button>
        </fieldset>

        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create work order'}
          </button>
          <Link to={editingId ? `/workorders/${editingId}` : '/'} className="button secondary-link">
            Cancel
          </Link>
        </div>
      </form>
    </>
  )
}
