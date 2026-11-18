import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, errorText } from '../api'
import { Field } from '../components/Field'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const reply = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
      })
      setMessage(reply.message)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card" aria-labelledby="forgot-heading">
        <h1 id="forgot-heading">Forgot your password?</h1>
        <p className="subtitle">Enter your email and we will send a link to choose a new password.</p>
        <Field label="Email" type="email" autoComplete="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success">
            {message}
          </p>
        )}
        <button type="submit" className="wide" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </form>
    </div>
  )
}
