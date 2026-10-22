import { useState } from 'react'
import api from '../api'

// Finds the named customer by email. Calls onFound(customer) so the parent can act on them.
export default function CustomerLookup({ onFound }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const find = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { onFound((await api.get('/loyalty/lookup', { params: { email } })).data) } catch { /* api.js toasted (e.g. no such customer) */ } finally { setBusy(false) }
  }

  return (
    <form className="input-group mb-3" onSubmit={find}>
      <input className="form-control" type="email" placeholder="Customer email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-primary" disabled={busy}>Find customer</button>
    </form>
  )
}
