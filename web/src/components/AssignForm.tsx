import { useState } from 'react'
import { SelectField } from './SelectField'
import { useApiData } from '../hooks/useApiData'
import { isFinalStatus, technicianLabel, type Technician, type WorkOrder } from '../workOrders/types'

interface AssignFormProps {
  order: WorkOrder
  busy: boolean
  onAssign: (technicianId: string) => void
}

// Staff only. The list comes from GET /api/users/technicians (available technicians).
export function AssignForm({ order, busy, onAssign }: AssignFormProps) {
  const { data, error, loading } = useApiData<{ technicians: Technician[] }>('/api/users/technicians')
  const [chosen, setChosen] = useState('')

  if (isFinalStatus(order.status)) return null

  // The API sorts by active job count ascending, so the first technician has the
  // lightest workload and is the one we recommend to the dispatcher.
  const options = (data?.technicians ?? []).map((t, index) => ({
    value: t._id,
    label: technicianLabel(t, index === 0),
  }))
  const verb = order.assignedTo ? 'Reassign' : 'Assign'

  return (
    <form
      className="card"
      aria-label={`${verb} technician`}
      onSubmit={(event) => {
        event.preventDefault()
        if (chosen) onAssign(chosen)
      }}
    >
      <h2>{verb} technician</h2>
      {loading && <p role="status">Loading technicians…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <SelectField
        label="Technician"
        emptyLabel="Choose a technician"
        value={chosen}
        onChange={(e) => setChosen(e.target.value)}
        options={options}
      />
      <button type="submit" disabled={!chosen || busy}>
        {verb}
      </button>
    </form>
  )
}
