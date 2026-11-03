import { useEffect, useState } from 'react'
import { errorText, type User } from '../api'
import { useAuth } from '../auth/useAuth'

// Protected page. It asks the API who we are (GET /api/auth/me) instead of trusting
// only what the browser remembers from login.
export function WelcomePage() {
  const { authedRequest } = useAuth()
  const [me, setMe] = useState<User | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    authedRequest<{ user: User }>('/api/auth/me')
      .then((reply) => {
        if (!cancelled) setMe(reply.user)
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err))
      })
    return () => {
      cancelled = true
    }
  }, [authedRequest])

  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    )
  }
  if (!me) return <p role="status">Loading your account…</p>

  return (
    <>
      <h1>Welcome, {me.firstName}</h1>
      <dl className="card details">
        <dt>Name</dt>
        <dd>
          {me.firstName} {me.lastName}
        </dd>
        <dt>Username</dt>
        <dd>{me.login}</dd>
        <dt>Email</dt>
        <dd>{me.email}</dd>
        <dt>Role</dt>
        <dd>{me.role}</dd>
      </dl>
      <p className="hint">
        Your session is kept only in memory. If you reload this page you will need to log in again.
      </p>
    </>
  )
}
