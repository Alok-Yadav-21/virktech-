import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/ui/Icon'
import AuthShell, { PasswordField } from '../../components/auth/AuthShell'
import { WORKSPACE } from '../../constants'

// Where to go after logging in: back to what they were doing, but never into another role's area.
export function landing(user, from) {
  const area = { '/app': 'customer', '/staff': 'staff', '/admin': 'admin' }[from?.match(/^\/(app|staff|admin)(\/|$|\?)/)?.[0].replace(/[/?]$/, '')]
  return from && (!area || area === user.role) ? from : WORKSPACE[user.role].home
}

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={landing(user, from)} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = await login(form.email.trim(), form.password)
      navigate(landing(u, from), { replace: true })
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to book repairs, track orders and use your points." footer={<>New here? <Link to="/register" state={{ from }} className="fw-semibold">Create an account</Link></>}>
      <form className="d-grid gap-3" onSubmit={submit}>
        <div>
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" className="form-control" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <PasswordField id="password" label="Password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <hr className="my-3" />
      <Link to="/till" className="btn btn-outline-secondary w-100"><Icon name="receipt" size={20} />Staff login</Link>
    </AuthShell>
  )
}
