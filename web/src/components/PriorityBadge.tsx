import { PRIORITY_LABELS, type Priority } from '../workOrders/types'

// Like StatusBadge: the priority is written as a word, color is only extra help.
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`priority priority-${priority}`}>{PRIORITY_LABELS[priority]}</span>
}
