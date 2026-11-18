import { STATUS_LABELS, type Status } from '../workOrders/types'

// The status is written out as text, so it never depends on color alone.
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>
}
