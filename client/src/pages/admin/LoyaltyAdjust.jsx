import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../api'
import CustomerLookup from '../../components/CustomerLookup'

// Admin correction of a customer's points. The note is mandatory and is stored with the entry.
export default function LoyaltyAdjust() {
  const [customer, setCustomer] = useState(null)
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const adjust = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/loyalty/adjust', { userId: customer.id, delta: Number(delta), note })
      toast.success(`Balance is now ${data.balance} points`)
      setCustomer({ ...customer, loyaltyPoints: data.balance })
      setDelta(''); setNote('')
    } catch { /* api.js already toasted the reason */ } finally { setBusy(false) }
  }

  return (
    <div className="col-lg-6">
      <h3 className="mb-3">Loyalty adjust</h3>
      <CustomerLookup onFound={setCustomer} />
      {customer && (
        <form className="card" onSubmit={adjust}>
          <div className="card-body">
            <p className="mb-3"><strong>{customer.name}</strong> · {customer.email}<br />Balance: <strong>{customer.loyaltyPoints} points</strong></p>
            <div className="mb-3">
              <label className="form-label">Points to add (use a minus to remove)</label>
              <input className="form-control" type="number" step="1" required value={delta} onChange={(e) => setDelta(e.target.value)} />
            </div>
            <div className="mb-3">
              <label className="form-label">Note (required)</label>
              <input className="form-control" required value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}>Apply adjustment</button>
          </div>
        </form>
      )}
    </div>
  )
}
