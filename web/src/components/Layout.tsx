import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { isStaff } from '../workOrders/types'

// Header + page area shared by every route.
export function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  // Everything except the account and users pages belongs to the "Work orders" tab.
  const tab = pathname.startsWith('/account') ? 'account' : pathname.startsWith('/users') ? 'users' : 'workorders'
  const tabProps = (name: string) => (tab === name ? { className: 'active', 'aria-current': 'page' as const } : {})

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
              <Link to="/" {...tabProps('workorders')}>
                Work orders
              </Link>
              {isStaff(user) && (
                <Link to="/users" {...tabProps('users')}>
                  Users
                </Link>
              )}
              <Link to="/account" {...tabProps('account')}>
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
