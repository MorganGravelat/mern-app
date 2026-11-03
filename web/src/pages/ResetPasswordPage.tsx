import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest, errorText } from '../api'
import { Field } from '../components/Field'

// The emailed link looks like /reset-password?token=...
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError('The two passwords do not match')
      return
    }
    setBusy(true)
    setError('')
    try {
      await apiRequest('/api/auth/reset-password', { method: 'POST', body: { token, password } })
      setDone(true)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <section className="auth-card" aria-labelledby="reset-heading">
          <h1 id="reset-heading">Reset password</h1>
          <p role="alert" className="error">
            This page needs the link from the reset email. <Link to="/forgot-password">Ask for a new link</Link>.
          </p>
        </section>
      </div>
    )
  }

  if (done) {
    return (
      <div className="auth-page">
        <section className="auth-card" aria-labelledby="reset-done-heading">
          <h1 id="reset-done-heading">Password updated</h1>
          <p role="status" className="success">
            Your password was changed and old sessions were signed out.
          </p>
          <p>
            <Link to="/login">Log in with your new password</Link>
          </p>
        </section>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card" aria-labelledby="reset-form-heading">
        <h1 id="reset-form-heading">Choose a new password</h1>
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="8 to 72 characters with at least one letter and one number."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={72}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="wide" disabled={busy}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}
