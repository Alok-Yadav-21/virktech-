import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthShell from '../../components/auth/AuthShell'
import { landing } from './Login'

// Staff sign in with their 4-digit PIN alone; it logs in as soon as the fourth digit is typed.
export default function StaffLogin() {
  const { user, pinLogin } = useAuth()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={landing(user)} replace />

  const change = async (e) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 4)
    setPin(next)
    if (next.length < 4) return
    setBusy(true)
    try {
      navigate(landing(await pinLogin(next)), { replace: true })
    } catch { setPin('') /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <AuthShell title="Staff login" subtitle="Type your 4-digit PIN." footer={<Link to="/login">Customer login</Link>}>
      <label className="form-label visually-hidden" htmlFor="pin">PIN</label>
      <input id="pin" className="form-control form-control-lg text-center" style={{ letterSpacing: '1rem', fontSize: '2rem' }}
        type="password" inputMode="numeric" autoComplete="off" maxLength={4} autoFocus disabled={busy} value={pin} onChange={change} />
    </AuthShell>
  )
}
