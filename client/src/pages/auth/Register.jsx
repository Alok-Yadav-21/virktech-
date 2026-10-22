import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthShell, { PasswordField } from '../../components/auth/AuthShell'
import Icon from '../../components/ui/Icon'
import { landing } from './Login'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={landing(user, from)} replace />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const u = await register({ ...form, email: form.email.trim(), name: form.name.trim() })
      navigate(landing(u, from), { replace: true })
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <AuthShell title="Create your account" subtitle="One account for repairs, orders and trade-ins." footer={<>Already have an account? <Link to="/login" state={{ from }} className="fw-semibold">Log in</Link></>}>
      <form className="d-grid gap-3" onSubmit={submit}>
        <div><label className="form-label" htmlFor="name">Full name</label><input id="name" className="form-control" required autoComplete="name" value={form.name} onChange={set('name')} /></div>
        <div><label className="form-label" htmlFor="email">Email</label><input id="email" className="form-control" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={set('email')} /></div>
        <div><label className="form-label" htmlFor="phone">Phone <span className="text-secondary fw-normal">(optional)</span></label><input id="phone" className="form-control" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></div>
        <PasswordField id="password" label="Password" autoComplete="new-password" minLength={8} hint="At least 8 characters." value={form.password} onChange={set('password')} />
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <ul className="list-unstyled small text-secondary d-grid gap-1 mb-0">
          <li className="d-flex gap-2"><Icon name="clock" size={18} className="flex-none text-success" />Track every repair and order from your phone.</li>
          <li className="d-flex gap-2"><Icon name="gift" size={18} className="flex-none text-success" />Earn loyalty points on what you spend.</li>
        </ul>
      </form>
    </AuthShell>
  )
}
