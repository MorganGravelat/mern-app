import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { apiError, authHeader, fakeSession, fakeUser, jsonResponse, mockFetch } from './test/helpers'

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('web authentication screens', () => {
  it('sends a logged-out visitor from the protected page to the login form', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Log in to OpsFlow' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username or email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByText('Reloading the page will sign you out.')).toBeInTheDocument()
  })

  it('shows and hides the typed password with the eye button', async () => {
    const user = userEvent.setup()
    renderApp('/login')

    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Show password' })
    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)
    expect(password).toHaveAttribute('type', 'password')
  })

  it('logs in, lands on the work orders, shows the user from /me, and logs out back to the login form', async () => {
    const user = userEvent.setup()
    mockFetch((path, init) => {
      if (path === '/api/auth/login') return jsonResponse(200, fakeSession())
      if (path === '/api/workorders') return jsonResponse(200, { workOrders: [] })
      if (path === '/api/auth/me') {
        return authHeader(init) === 'Bearer access-1'
          ? jsonResponse(200, { user: fakeUser })
          : apiError(401, 'UNAUTHENTICATED', 'Missing access token')
      }
      return jsonResponse(204) // logout
    })
    renderApp('/')

    await user.type(screen.getByLabelText('Username or email'), 'jrivera')
    await user.type(screen.getByLabelText('Password'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('heading', { name: 'Work orders' })).toBeInTheDocument()
    // The header shows who is logged in (name and role come from the login reply).
    expect(screen.getByText('Jamie Rivera')).toBeInTheDocument()
    expect(screen.getByText('Technician')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Work orders' })).toHaveClass('active')
    await user.click(screen.getByRole('link', { name: 'Account' }))
    expect(await screen.findByRole('heading', { name: 'Welcome, Jamie' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('jamie@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByRole('heading', { name: 'Log in to OpsFlow' })).toBeInTheDocument()
  })

  it('shows the API message and a resend form when the email is not verified', async () => {
    const user = userEvent.setup()
    mockFetch((path) =>
      path === '/api/auth/login'
        ? apiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in')
        : jsonResponse(200, { message: 'If that email belongs to an account, we sent it a link.' }),
    )
    renderApp('/login')

    await user.type(screen.getByLabelText('Username or email'), 'jamie@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Verify your email before logging in')
    // The email typed into the login box is reused for the resend form
    const resendEmail = screen.getByLabelText('Email for resend')
    expect(resendEmail).toHaveValue('jamie@example.com')

    await user.click(screen.getByRole('button', { name: 'Send a new link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('we sent it a link')
  })

  it('shows a wrong-password error from the API', async () => {
    const user = userEvent.setup()
    mockFetch(() => apiError(401, 'INVALID_CREDENTIALS', 'Login or password is incorrect'))
    renderApp('/login')

    await user.type(screen.getByLabelText('Username or email'), 'jrivera')
    await user.type(screen.getByLabelText('Password'), 'wrong-password1')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Login or password is incorrect')
  })

  it('registers and then tells the user to verify before logging in', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(() =>
      jsonResponse(201, { message: 'Account created. Check your email for a verification link.', user: fakeUser }),
    )
    renderApp('/register')

    await user.type(screen.getByLabelText('First name'), 'Jamie')
    await user.type(screen.getByLabelText('Last name'), 'Rivera')
    await user.type(screen.getByLabelText('Username'), 'jrivera')
    await user.type(screen.getByLabelText('Email'), 'jamie@example.com')
    await user.type(screen.getByLabelText('Password'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      firstName: 'Jamie',
      lastName: 'Rivera',
      login: 'jrivera',
      email: 'jamie@example.com',
      password: 'Password123!',
    })
  })

  it('shows field messages when registration is rejected', async () => {
    const user = userEvent.setup()
    mockFetch(() =>
      apiError(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', [
        { field: 'password', message: 'Password must contain a number' },
      ]),
    )
    renderApp('/register')

    await user.type(screen.getByLabelText('First name'), 'Jamie')
    await user.type(screen.getByLabelText('Last name'), 'Rivera')
    await user.type(screen.getByLabelText('Username'), 'jrivera')
    await user.type(screen.getByLabelText('Email'), 'jamie@example.com')
    await user.type(screen.getByLabelText('Password'), 'passwordonly')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Password must contain a number')
  })

  it('requests a reset link from the forgot-password form', async () => {
    const user = userEvent.setup()
    mockFetch(() => jsonResponse(200, { message: 'If that email belongs to an account, we sent it a link.' }))
    renderApp('/forgot-password')

    await user.type(screen.getByLabelText('Email'), 'jamie@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('status')).toHaveTextContent('we sent it a link')
  })

  it('sends the token from the URL and the new password to reset-password', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(() => jsonResponse(200, { message: 'Password updated. You can now log in.' }))
    renderApp('/reset-password?token=abc123')

    await user.type(screen.getByLabelText('New password'), 'NewPassword456')
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPassword456')
    await user.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument()
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      token: 'abc123',
      password: 'NewPassword456',
    })
  })

  it('does not call the API when the two new passwords differ', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch(() => jsonResponse(200, {}))
    renderApp('/reset-password?token=abc123')

    await user.type(screen.getByLabelText('New password'), 'NewPassword456')
    await user.type(screen.getByLabelText('Confirm new password'), 'Different789')
    await user.click(screen.getByRole('button', { name: 'Save new password' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('do not match'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('explains that the reset page needs the emailed link when the token is missing', () => {
    renderApp('/reset-password')
    expect(screen.getByRole('alert')).toHaveTextContent('needs the link from the reset email')
  })
})
