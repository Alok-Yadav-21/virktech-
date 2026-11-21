import { useState } from 'react'
import api from '../api'
import useFetch from '../hooks/useFetch'

const NEW = '__new__'

// A staff role dropdown the admin can add to: pick one, or choose "Add a new role…", type it, and it is saved and selected.
export default function RolePicker({ id, value, onChange }) {
  const { data, reload } = useFetch('/staff-roles')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    setBusy(true)
    try {
      const r = await api.post('/staff-roles', { name })
      onChange(r.data.name)
      setAdding(false); setName('')
      reload()
    } catch { /* api.js already toasted why (e.g. it already exists) */ } finally { setBusy(false) }
  }

  if (adding) {
    return (
      <div className="input-group">
        <input id={id} className="form-control" maxLength={40} autoFocus placeholder="New role, e.g. Cleaner" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn btn-primary" disabled={busy || !name.trim()} onClick={add}>Add role</button>
        <button type="button" className="btn btn-outline-secondary" onClick={() => { setAdding(false); setName('') }}>Cancel</button>
      </div>
    )
  }
  return (
    <select id={id} className="form-select" value={value ?? ''} onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))}>
      <option value="">No role</option>
      {data?.map((r) => <option key={r} value={r}>{r}</option>)}
      <option value={NEW}>+ Add a new role…</option>
    </select>
  )
}
