import { useState } from 'react'
import api from '../../api'
import { Link } from 'react-router-dom'
import AuthShell from '../../components/auth/AuthShell'
import PinPad from '../../components/PinPad'

// The till's own sign-in: whoever sits down taps their PIN on the keypad. It signs in to the till only, never to a dashboard.
export default function TillLogin({ onSignedIn }) {
  const [busy, setBusy] = useState(false)

  const submit = async (pin) => {
    setBusy(true)
    try {
      await api.post('/till/login', { pin })
      onSignedIn()
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <div className="container py-5">
      <AuthShell title="Till" subtitle="Tap your 6-digit PIN to use the till." footer={<Link to="/login">Back to login</Link>}>
        <PinPad onComplete={submit} disabled={busy} />
      </AuthShell>
    </div>
  )
}
