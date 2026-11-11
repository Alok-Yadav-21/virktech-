import { useState } from 'react'
import api from '../../api'
import { Link } from 'react-router-dom'
import AuthShell from '../../components/auth/AuthShell'

// The till's own sign-in: whoever sits down types their PIN. It signs in to the till only, never to a dashboard.
export default function TillLogin({ onSignedIn }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  const change = async (e) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(next)
    if (next.length < 4) return
    setBusy(true)
    try {
      await api.post('/till/login', { pin: next })
      onSignedIn()
    } catch { setPin('') /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <div className="container py-5">
      <AuthShell title="Till" subtitle="Type your 4-digit PIN to use the till." footer={<Link to="/login">Back to login</Link>}>
        <label className="form-label visually-hidden" htmlFor="till-pin">PIN</label>
        <input id="till-pin" className="form-control form-control-lg text-center" style={{ letterSpacing: '1rem', fontSize: '2rem' }}
          type="password" inputMode="numeric" autoComplete="off" maxLength={4} autoFocus disabled={busy} value={pin} onChange={change} />
      </AuthShell>
    </div>
  )
}
