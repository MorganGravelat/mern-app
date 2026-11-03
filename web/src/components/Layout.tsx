import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

// Header + page area shared by every route.
export function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  // Everything except the account page belongs to the "Work orders" tab.
  const inWorkOrders = !pathname.startsWith('/account')

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={user ? 'site-header' : 'site-header guest'}>
        <Link to={user ? '/' : '/login'} className="brand">
          <span className="brand-mark" aria-hidden="true">
            [ ]
          </span>
          <span className="brand-name">
            OpsFlow
            {!user && (
              <span className="brand-cursor" aria-hidden="true">
                _
              </span>
            )}
          </span>
          <span className="brand-tagline">IT WORK ORDERS</span>
        </Link>
        {user && (
          <>
            <nav aria-label="Main">
              <Link to="/" className={inWorkOrders ? 'active' : undefined} aria-current={inWorkOrders ? 'true' : undefined}>
                Work orders
              </Link>
              <Link to="/account" className={inWorkOrders ? undefined : 'active'} aria-current={inWorkOrders ? undefined : 'page'}>
                Account
              </Link>
            </nav>
            <div className="user-chip">
              <span className="avatar" aria-hidden="true">
                {user.firstName.charAt(0)}
                {user.lastName.charAt(0)}
              </span>
              <span className="user-text">
                <span className="user-name">
                  {user.firstName} {user.lastName}
                </span>
                <span className="user-role">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
              </span>
              <button type="button" className="link-button" onClick={() => void logout()}>
                Log out
              </button>
            </div>
          </>
        )}
      </header>
      <main id="main" className="page">
        <Outlet />
      </main>
    </>
  )
}
