import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { gbp } from '../format'

// "Bought for" cell on the profit pages (admin only). A recorded delivery decides the price, so there is
// nothing to type; otherwise admin types the price here and it saves to the product (the server checks it).
export default function CostEdit({ url, id, cost, source, onSaved }) {
  const [value, setValue] = useState(cost ?? '')
  const [busy, setBusy] = useState(false)

  if (source === 'deliveries') return <>{gbp(cost)}<span className="d-block small text-secondary">from deliveries</span></>

  const save = async () => {
    if (value === '' || Number(value) < 0) return toast.error('Enter the price you paid, 0 or more')
    setBusy(true)
    try {
      await api.put(`${url}/${id}`, { costPrice: Number(value) })
      toast.success('Saved')
      onSaved()
    } catch { /* api.js already toasted the server message */ } finally { setBusy(false) }
  }

  return (
    <form className="d-flex justify-content-end gap-1" onSubmit={(e) => { e.preventDefault(); save() }}>
      <input type="number" step="0.01" min="0" className={`form-control form-control-sm text-end ${cost == null ? 'border-danger' : ''}`} style={{ width: '5.5rem' }}
        aria-label="Bought for (£)" placeholder="£" value={value} onChange={(e) => setValue(e.target.value)} />
      <button className="btn btn-sm btn-primary" disabled={busy || String(value) === String(cost ?? '')}>Save</button>
    </form>
  )
}
