import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ApiError, errorText } from '../api'
import { useAuth } from '../auth/useAuth'
import { Field } from '../components/Field'
import { ResendVerification } from '../components/ResendVerification'

export function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [loginName, setLoginName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)

  // After logging in, go back to the page the user originally asked for.
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNeedsVerification(false)
    try {
      await login(loginName, password)
    } catch (err) {
      setError(errorText(err))
      setNeedsVerification(err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED')
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card" aria-labelledby="login-heading">
        <p className="eyebrow">WELCOME BACK</p>
        <h1 id="login-heading">Log in to OpsFlow</h1>
        <p className="subtitle">Your next work order starts here.</p>
        <Field
          label="Username or email"
          autoComplete="username"
          placeholder="Enter your username or email"
          value={loginName}
          onChange={(e) => setLoginName(e.target.value)}
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <p className="forgot-link">
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="wide" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
      {needsVerification && (
        <>
          <p>
            Open the verification link we emailed you, then log in again. Lost the email? Ask for a new one:
          </p>
          <ResendVerification initialEmail={loginName.includes('@') ? loginName : ''} />
        </>
      )}
      {/* The session lives only in memory (see AuthProvider), so say so up front. */}
      <p className="auth-footnote">Reloading the page will sign you out.</p>
    </div>
  )
}
