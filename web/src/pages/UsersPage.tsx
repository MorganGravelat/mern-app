import { useState } from 'react'
import { errorText, type Role } from '../api'
import { useAuth } from '../auth/useAuth'
import { useApiData } from '../hooks/useApiData'
import { personName } from '../workOrders/types'

interface UserSummary {
  _id: string
  firstName: string
  lastName: string
  login: string
  role: Role
}

const ROLE_LABELS: Record<Role, string> = { admin: 'Admin', dispatcher: 'Dispatcher', technician: 'Technician' }

// Staff only (see StaffRoute). Lists every account and lets staff promote a technician to
// dispatcher, or demote a dispatcher back to technician. Admin accounts are seeded root
// accounts and aren't managed here.
export function UsersPage() {
  const { user: me, authedRequest } = useAuth()
  const { data, error, loading, setData } = useApiData<{ users: UserSummary[] }>('/api/users')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  async function changeRole(target: UserSummary, role: 'dispatcher' | 'technician') {
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const reply = await authedRequest<{ user: UserSummary }>(`/api/users/${target._id}/role`, {
        method: 'PATCH',
        body: { role },
      })
      setData((current) =>
        current ? { users: current.users.map((u) => (u._id === reply.user._id ? reply.user : u)) } : current,
      )
      setNotice(
        role === 'dispatcher'
          ? `${personName(reply.user)} is now a dispatcher.`
          : `${personName(reply.user)} is no longer a dispatcher.`,
      )
      setConfirmingId(null)
    } catch (err) {
      setActionError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const users = data?.users ?? []

  return (
    <>
      <div className="toolbar page-head">
        <div>
          <p className="eyebrow">WORKSPACE / USERS</p>
          <h1>Users</h1>
          <p className="subtitle">
            Everyone with an OpsFlow account. Promote a technician to dispatcher, or remove dispatcher access.
          </p>
        </div>
      </div>

      {notice && (
        <p role="status" className="banner">
          {notice}
        </p>
      )}
      {loading && <p role="status">Loading users…</p>}
      {(error || actionError) && (
        <p role="alert" className="error">
          {actionError || error}
        </p>
      )}

      {users.length > 0 && (
        <>
          <div className="list-summary">
            <span>
              {users.length} {users.length === 1 ? 'user' : 'users'}
            </span>
            <span>Admins first</span>
          </div>
          <table className="order-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u._id === me?._id
                const action = u.role === 'dispatcher' ? 'demote' : u.role === 'technician' ? 'promote' : null
                const nextRole = action === 'promote' ? 'dispatcher' : 'technician'
                const confirmLabel = action === 'promote' ? 'Yes, make dispatcher' : 'Yes, remove dispatcher'
                const buttonLabel = action === 'promote' ? 'Make dispatcher' : 'Remove dispatcher'
                const buttonClass = action === 'promote' ? 'secondary' : 'danger'
                return (
                  <tr key={u._id}>
                    <td data-label="Name">
                      <span className="order-title">{personName(u)}</span>
                      {isMe && <span className="hint"> (you)</span>}
                    </td>
                    <td data-label="Username">{u.login}</td>
                    <td data-label="Role">
                      <span className={`badge role-${u.role}`}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td data-label="Action">
                      {action === null || isMe ? (
                        <span className="hint">—</span>
                      ) : confirmingId === u._id ? (
                        <div role="group" aria-label={`Confirm ${action === 'promote' ? 'making' : 'removing dispatcher from'} ${personName(u)}`} className="row-actions">
                          <button type="button" className={buttonClass} disabled={busy} onClick={() => void changeRole(u, nextRole)}>
                            {confirmLabel}
                          </button>
                          <button type="button" className="link-button" onClick={() => setConfirmingId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={buttonClass}
                          aria-label={`${buttonLabel} for ${personName(u)}`}
                          onClick={() => {
                            setConfirmingId(u._id)
                            setNotice('')
                            setActionError('')
                          }}
                        >
                          {buttonLabel}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  )
}
