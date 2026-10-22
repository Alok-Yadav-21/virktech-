import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../api'
import CustomerLookup from '../../components/CustomerLookup'
import { redemption } from '../../constants'
import { gbp } from '../../format'

// Redeem points at the counter for a named customer, against a repair quote or a till bill.
export default function CounterLoyalty() {
  const [customer, setCustomer] = useState(null)
  const [repairRef, setRepairRef] = useState('')
  const [bill, setBill] = useState('')
  const [points, setPoints] = useState('')
  const [busy, setBusy] = useState(false)

  // Preview only (bill is the typed amount); the server works out the real figure from the repair's quote.
  const preview = repairRef ? null : redemption({ requested: points, balance: customer?.loyaltyPoints, bill })

  const redeem = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/loyalty/redeem', {
        customerId: customer.id, points: Number(points),
        ...(repairRef ? { repairRef: repairRef.trim().toUpperCase() } : { billAmount: Number(bill) }),
      })
      toast.success(`${data.points} points used: ${gbp(data.discount)} off. Balance ${data.balance}.`)
      setCustomer({ ...customer, loyaltyPoints: data.balance })
      setPoints(''); setBill(''); setRepairRef('')
    } catch { /* api.js already toasted the reason */ } finally { setBusy(false) }
  }

  return (
    <div className="col-lg-6">
      <h3 className="mb-3">Counter loyalty</h3>
      <CustomerLookup onFound={setCustomer} />
      {customer && (
        <form className="card" onSubmit={redeem}>
          <div className="card-body">
            <p className="mb-3"><strong>{customer.name}</strong> · {customer.email}<br />Balance: <strong>{customer.loyaltyPoints} points</strong></p>
            <div className="mb-3">
              <label className="form-label">Repair reference (optional)</label>
              <input className="form-control" placeholder="e.g. SPR-4801" value={repairRef} onChange={(e) => setRepairRef(e.target.value)} />
              <div className="form-text">Leave empty for a till sale and enter the bill instead.</div>
            </div>
            {!repairRef && (
              <div className="mb-3">
                <label className="form-label">Bill amount (£)</label>
                <input className="form-control" type="number" min="0" step="0.01" required value={bill} onChange={(e) => setBill(e.target.value)} />
              </div>
            )}
            <div className="mb-3">
              <label className="form-label">Points to use</label>
              <input className="form-control" type="number" min="10" step="10" required value={points} onChange={(e) => setPoints(e.target.value)} />
              <div className="form-text">
                10 points = £2, up to 20% of the bill. Too many are trimmed automatically.
                {preview && preview.points > 0 && <strong> Will use {preview.points} points for {gbp(preview.discount)} off.</strong>}
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy}>Redeem</button>
          </div>
        </form>
      )}
    </div>
  )
}
