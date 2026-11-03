import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiRequest, errorText } from '../api'
import { Field } from '../components/Field'
import { ResendVerification } from '../components/ResendVerification'

const emptyForm = { firstName: '', lastName: '', login: '', email: '', password: '' }

export function RegisterPage() {
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')

  function setField(name: keyof typeof emptyForm, value: string) {
    setForm((old) => ({ ...old, [name]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      // Registering does not log you in. You must verify your email first.
      await apiRequest('/api/auth/register', { method: 'POST', body: form })
      setRegisteredEmail(form.email)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (registeredEmail) {
    return (
      <div className="auth-page">
        <section className="auth-card" aria-labelledby="registered-heading">
          <h1 id="registered-heading">Check your email</h1>
          <p role="status" className="success">
            Account created. We sent a verification link to <strong>{registeredEmail}</strong>.
          </p>
          <ol>
            <li>Open the link in the email. The browser will show a short message from the API saying the email is verified.</li>
            <li>
              Come back here and <Link to="/login">log in</Link>. Logging in is blocked until the email is verified.
            </li>
          </ol>
          <p className="hint">Running locally without an email key? The link is printed in the terminal where the API runs.</p>
        </section>
        <ResendVerification initialEmail={registeredEmail} />
      </div>
    )
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card" aria-labelledby="register-heading">
        <h1 id="register-heading">Create your account</h1>
        <p className="subtitle">Join your team's IT workspace.</p>
        <div className="field-row">
          <Field label="First name" autoComplete="given-name" placeholder="Enter first name" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} required maxLength={50} />
          <Field label="Last name" autoComplete="family-name" placeholder="Enter last name" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} required maxLength={50} />
        </div>
        <Field
          label="Username"
          autoComplete="username"
          placeholder="Choose a username"
          hint="3 to 30 letters, numbers, dots, dashes or underscores."
          value={form.login}
          onChange={(e) => setField('login', e.target.value)}
          required
          minLength={3}
          maxLength={30}
        />
        <Field label="Email" type="email" autoComplete="email" placeholder="Enter your email" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="8 to 72 characters with at least one letter and one number."
          value={form.password}
          onChange={(e) => setField('password', e.target.value)}
          required
          minLength={8}
          maxLength={72}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="wide" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="hint">New accounts are registered as technicians. Verify your email before logging in.</p>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  )
}
