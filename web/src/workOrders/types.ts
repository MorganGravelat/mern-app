import type { User } from '../api'

export type Status = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type Category = 'network' | 'hardware' | 'software' | 'security' | 'account'

export const STATUSES: Status[] = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled']
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical']
export const CATEGORIES: Category[] = ['network', 'hardware', 'software', 'security', 'account']

export const CATEGORY_LABELS: Record<Category, string> = {
  network: 'Network',
  hardware: 'Hardware',
  software: 'Software',
  security: 'Security',
  account: 'Account',
}

export const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
}

export interface ChecklistItem {
  task: string
  done: boolean
}

export interface PersonName {
  _id: string
  firstName: string
  lastName: string
}

export interface Technician extends PersonName {
  isAvailable: boolean
  activeJobCount: number // jobs currently assigned or in progress; see GET /api/users/technicians
}

export interface WorkOrder {
  _id: string
  orderNumber: string
  title: string
  description: string
  customerName: string
  location: string
  category: Category
  priority: Priority
  status: Status
  checklist: ChecklistItem[]
  createdBy: PersonName | null
  assignedTo: PersonName | null
  dueDate: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

// Only used to decide which buttons to show. The API checks the role again on every request.
export function isStaff(user: User): boolean {
  return user.role === 'admin' || user.role === 'dispatcher'
}

// Completed and cancelled work orders are final: the API refuses any change.
export function isFinalStatus(status: Status): boolean {
  return status === 'completed' || status === 'cancelled'
}

export function personName(person: PersonName | null, emptyText = 'Unassigned'): string {
  return person ? `${person.firstName} ${person.lastName}` : emptyText
}

// Label for the assignment dropdown, e.g. "Sofia Ramirez · 1 active job · Recommended".
// The API already sorts technicians by active job count (fewest first), so the first
// one in the list is the one with the lightest workload.
export function technicianLabel(technician: Technician, isLightestWorkload: boolean): string {
  const jobWord = technician.activeJobCount === 1 ? 'active job' : 'active jobs'
  const recommendation = isLightestWorkload ? ' · Recommended' : ''
  return `${personName(technician)} · ${technician.activeJobCount} ${jobWord}${recommendation}`
}

// Due dates are stored at midnight UTC, so show them in UTC to avoid "yesterday" in US time zones.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })
}

// Short date for the table, e.g. "Nov 6". Same UTC reasoning as formatDate.
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

// The value an <input type="date"> uses: YYYY-MM-DD.
export function dateInputValue(iso: string): string {
  return iso.slice(0, 10)
}
