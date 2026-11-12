import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import BackLink from '../components/ui/BackLink'
import { PasswordField } from '../components/auth/AuthShell'
import { FormSection } from '../components/ui/FormBits'
import { WORKSPACE } from '../constants'

export default function Profile() {
  const { user, refresh } = useAuth()
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', currentPassword: '', newPassword: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const customer = user.role === 'customer'

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch('/auth/me', form)
      toast.success('Saved')
      setForm({ ...form, currentPassword: '', newPassword: '' })
      await refresh()
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="mx-auto" style={{ maxWidth: 560 }}>
      {customer && <BackLink to="/app/me">Me</BackLink>}
      <h1 className="h3 mb-3">Profile</h1>
      <FormSection title="Your details">
        <div className="d-grid gap-3">
          <div><label className="form-label" htmlFor="email">Email</label><input id="email" className="form-control" value={user.email} disabled aria-describedby="email-help" /><div id="email-help" className="form-text">To change your email, contact {customer ? 'a branch' : 'an admin'}.</div></div>
          <div><label className="form-label" htmlFor="name">Name</label><input id="name" className="form-control" required autoComplete="name" value={form.name} onChange={set('name')} /></div>
          <div><label className="form-label" htmlFor="phone">Phone</label><input id="phone" className="form-control" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} /></div>
        </div>
      </FormSection>
      {/* Staff sign-in details are changed by an admin only. */}
      {user.role !== 'staff' && (
        <FormSection title="Change password" hint="Leave these empty to keep your current password. Changing it signs you out everywhere else.">
          <div className="d-grid gap-3">
            <PasswordField id="current" label="Current password" autoComplete="current-password" required={false} value={form.currentPassword} onChange={set('currentPassword')} />
            <PasswordField id="new" label="New password" autoComplete="new-password" required={false} hint="At least 8 characters." value={form.newPassword} onChange={set('newPassword')} />
          </div>
        </FormSection>
      )}
      <button className="btn btn-primary btn-lg w-100" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      <p className="small text-secondary text-center mt-3">Your account home is <a href={WORKSPACE[user.role].home}>{WORKSPACE[user.role].home}</a>.</p>
    </form>
  )
}
