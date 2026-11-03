import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// Wraps pages that need a logged-in user. The server still checks the token on every API call;
// this only decides which screen to show.
export function ProtectedRoute() {
  const { user, signedOutOnPurpose } = useAuth()
  const location = useLocation()
  if (!user) {
    // Remember the page so login can return to it, unless the user just chose to log out.
    const state = signedOutOnPurpose ? undefined : { from: location.pathname }
    return <Navigate to="/login" replace state={state} />
  }
  return <Outlet />
}
