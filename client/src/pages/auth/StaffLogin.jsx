import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import PinPad from '../../components/PinPad'
import { landing } from './Login'

// Staff sign in with their 4-digit PIN alone, tapped on the keypad; it logs in as soon as the fourth digit is entered.
export default function StaffLogin() {
  const { user, pinLogin } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={landing(user)} replace />

  const submit = async (pin) => {
    setBusy(true)
    try {
      navigate(landing(await pinLogin(pin)), { replace: true })
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <AuthShell title="Staff login" subtitle="Type your 4-digit PIN." footer={<><Link to="/till" className="fw-semibold">Open the till</Link> · <Link to="/login">Customer login</Link></>}>
      <PinPad onComplete={submit} disabled={busy} />
    </AuthShell>
  )
}
