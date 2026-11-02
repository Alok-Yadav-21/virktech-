import { Modal } from 'react-bootstrap'
import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { ErrorState } from '../../components/ui/primitives'
import { gbp } from '../../format'

const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// Your sales today: takings by cash/card, electronics and vapes as separate figures, and a void for mistakes.
export default function TillToday({ onHide, onVoided }) {
  const { data, error, reload } = useFetch('/till/today')

  const voidSale = async (s) => {
    if (!window.confirm(`Void ${s.reference}? The money is refunded and the stock goes back.`)) return
    try {
      await api.post(`/till/sales/${s.reference}/void`)
      toast.success('Sale voided')
      reload()
      onVoided()
    } catch { /* api.js already toasted why */ }
  }

  return (
    <Modal show onHide={onHide} centered scrollable size="xl">
      <Modal.Header closeButton><Modal.Title>Your sales today</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <ErrorState onRetry={reload}>We could not load today's sales.</ErrorState>}
        {data && (
          <>
            <div className="row g-2 mb-3">
              {[['Sales', data.summary.count], ['Cash', gbp(data.summary.cash) || '£0'], ['Card', gbp(data.summary.card) || '£0'],
                ['Electronics', gbp(data.summary.electronics) || '£0'], ['Vapes', gbp(data.summary.vape) || '£0']].map(([k, v]) => (
                <div key={k} className="col-6 col-md"><div className="vt-card p-2 text-center"><span className="small text-secondary d-block">{k}</span><strong>{v}</strong></div></div>
              ))}
            </div>
            {!data.sales.length && <p className="text-secondary">No sales yet today.</p>}
            {data.sales.map((s) => (
              <div key={s.reference} className="d-flex align-items-center gap-3 py-2 border-bottom">
                <span className="me-auto">
                  <strong>{s.reference}</strong> <span className="small text-secondary">{time(s.paid_at)} · {s.payment_method === 'cash' ? 'cash' : 'card'}{s.status !== 'collected' && ' · voided'}</span>
                  <span className="d-block small text-secondary">{s.items.map((i) => `${i.qty} x ${i.name}`).join(', ')}</span>
                </span>
                <strong className={s.status === 'collected' ? '' : 'text-decoration-line-through text-secondary'}>{gbp(s.total)}</strong>
                {s.voidable && <button className="btn btn-sm btn-outline-danger" onClick={() => voidSale(s)}>Void</button>}
              </div>
            ))}
          </>
        )}
      </Modal.Body>
    </Modal>
  )
}
