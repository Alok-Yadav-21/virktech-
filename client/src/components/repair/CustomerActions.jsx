import { useState } from 'react'
import api from '../../api'
import Icon from '../ui/Icon'
import { REPAIR_STATUS as S } from '../../constants'
import { gbp } from '../../format'

// What the customer can do: see and answer the quote, or cancel while that is still possible.
// Buttons come from the server's `allowed` list, so they can never offer a move the server would refuse.
export default function CustomerActions({ repair, act }) {
  const [reason, setReason] = useState('')
  const url = `/repairs/${repair.reference}/status`
  const quoting = repair.status === S.QUOTE
  const canApprove = repair.allowed.includes(S.IN_PROGRESS)
  const canCancel = repair.allowed.includes(S.CANCELLED)

  return (
    <>
      {repair.quote != null && (
        <section className={`vt-card p-3 mb-3 ${quoting ? 'vt-card--attention' : ''}`} aria-label="Your quote">
          <p className="small mb-0">{quoting ? 'Your quote' : 'Quote'}</p>
          <p className="vt-price mb-1" style={{ fontSize: '2rem' }}>{gbp(repair.amountDue ?? repair.quote)}</p>
          {repair.loyaltyDiscount > 0 && <p className="small mb-1">{gbp(repair.quote)} less {gbp(repair.loyaltyDiscount)} loyalty discount</p>}
          <p className="small mb-0 d-flex gap-2"><Icon name="shield" size={18} className="flex-none" />{repair.paymentStatus === 'paid' ? 'Paid. Thank you.' : 'You pay when you collect. Nothing starts until you approve.'}</p>
        </section>
      )}

      {canApprove && (
        <div className="vt-bar" role="region" aria-label="Answer your quote">
          <div className="container d-flex gap-2">
            <button className="btn btn-outline-danger px-3" onClick={() => window.confirm('Decline this quote? The repair will be cancelled.') && act(api.patch(url, { status: S.CANCELLED }), 'Quote declined')}>Decline</button>
            <button className="btn btn-primary flex-grow-1" onClick={() => act(api.patch(url, { status: S.IN_PROGRESS }), 'Quote approved')}>Approve {gbp(repair.amountDue ?? repair.quote)}</button>
          </div>
        </div>
      )}

      {canCancel && !quoting && (
        <details className="vt-card px-3 mb-3">
          <summary className="vt-sum">Need to cancel?</summary>
          <div className="pb-3">
            <label className="form-label" htmlFor="cancel-reason">Tell us why</label>
            <input id="cancel-reason" className="form-control mb-2" value={reason} onChange={(e) => setReason(e.target.value)} />
            <button className="btn btn-outline-danger w-100" disabled={!reason.trim()} onClick={() => window.confirm('Cancel this booking?') && act(api.patch(url, { status: S.CANCELLED, reason }), 'Booking cancelled')}>Cancel booking</button>
          </div>
        </details>
      )}
    </>
  )
}
