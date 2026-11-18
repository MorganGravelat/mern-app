import { useState, type FormEvent } from 'react'
import { apiRequest, errorText } from '../api'
import { Field } from './Field'

// Asks the API to email a new verification link. The API gives the same answer
// whether or not the email has an account, so we show its message as-is.
export function ResendVerification({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const reply = await apiRequest<{ message: string }>('/api/auth/resend-verification', {
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
    <form onSubmit={handleSubmit} className="card" aria-label="Resend verification email">
      <h2>Resend verification email</h2>
      <Field
        label="Email for resend"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
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
      <button type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send a new link'}
      </button>
    </form>
  )
}
