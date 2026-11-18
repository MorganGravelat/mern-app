import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { isStaff } from '../workOrders/types'

// For pages only admins and dispatchers use (create and edit). The API refuses technicians too.
export function StaffRoute() {
  const { user } = useAuth()
  if (!user || !isStaff(user)) return <Navigate to="/" replace />
  return <Outlet />
}
