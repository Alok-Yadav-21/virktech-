import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import BackLink from '../../components/ui/BackLink'
import Facts from '../../components/ui/Facts'
import Icon from '../../components/ui/Icon'
import { EmptyState, ErrorState, Skeleton, StatusPill } from '../../components/ui/primitives'
import { ORDER_TONE, PAYMENT_LABELS } from '../../constants'
import { VAPE_STATUSES, VAPE_CUSTOMER_STATUSES, nicotineLabel, vapeOrdersBase } from '../../vapeConstants'
import { gbp, when } from '../../format'

// One detail page for all roles; the server decides which actions are offered.
export default function VapeOrderDetail() {
  const { ref } = useParams()
  const { state } = useLocation()
  const { user } = useAuth()
  const { data: o, loading, error, reload } = useFetch(`/vapes/orders/${ref}`)
  const [next, setNext] = useState('')
  const base = vapeOrdersBase(user.role)
  const customer = user.role === 'customer'
  const labels = customer ? VAPE_CUSTOMER_STATUSES : VAPE_STATUSES

  const act = async (request, msg) => {
    try { await request; toast.success(msg); setNext(''); await reload() } catch { /* toasted by api.js */ }
  }

  if (loading && !o) return <div className="d-grid gap-3"><Skeleton h="4rem" /><Skeleton h="12rem" /></div>
  if (error) {
    return error.response?.status === 404
      ? <EmptyState icon="search" title="We could not find that order" action={<BackLink to={base}>Back to orders</BackLink>}>Check the reference, or look in your list.</EmptyState>
      : <ErrorState onRetry={reload}>We could not load this order.</ErrorState>
  }
  const url = `/vapes/orders/${o.reference}`
  const open = o.status === 'pending' || o.status === 'ready'

  return (
    <>
      <BackLink to={base}>Vape orders</BackLink>
      {state?.placed && (
        <div className="alert alert-success d-flex gap-2" role="status"><Icon name="check" size={22} className="flex-none" />
          <span><strong className="d-block">Order placed</strong>Bring this reference and photo ID to {o.branch.area}. You pay at the counter.</span></div>
      )}
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div className="min-w-0"><h1 className="h3 mb-1">{o.reference}</h1><p className="text-secondary mb-0">{when(o.createdAt)}</p></div>
        <StatusPill tone={ORDER_TONE[o.status]}>{labels[o.status]}</StatusPill>
      </div>

      {!customer && open && (
        <div className="alert alert-warning d-flex gap-2" role="note"><Icon name="alert" size={22} className="flex-none" />
          <span><strong className="d-block">Check photo ID before handing over</strong>The customer confirmed they are 18 or over when ordering. Do not release the order without ID if you are unsure.</span></div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <section className="vt-card p-3 mb-3" aria-label="Items">
            <h2 className="h6 mb-3">Items</h2>
            <ul className="list-unstyled d-grid gap-2 mb-3">
              {o.items.map((i) => (
                <li key={i.productId} className="d-flex justify-content-between gap-3">
                  <span>{i.qty} × {i.name}{i.flavour && <span className="d-block small text-secondary">{i.flavour} · {nicotineLabel(i.nicotineMg)}</span>}</span>
                  <span className="vt-price">{gbp(Math.round(i.price * 100) * i.qty / 100)}</span>
                </li>
              ))}
            </ul>
            <p className="d-flex justify-content-between align-items-baseline border-top pt-3 mb-0"><strong>Total</strong><span className="vt-price" style={{ fontSize: '1.4rem' }}>{gbp(o.total)}</span></p>
          </section>
          <section className="vt-card p-3 mb-3" aria-label="Collection and payment">
            <h2 className="h6 mb-3">Collection and payment</h2>
            <Facts items={[
              !customer && ['Customer', `${o.customer.name} · ${o.customer.email}`],
              ['Collect from', o.branch.area],
              ['Payment', `${PAYMENT_LABELS[o.paymentMethod].split(' (')[0]} · ${o.paymentStatus === 'paid' ? 'Paid' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Pay on collection'}`],
              ['Age', '18 or over, confirmed at checkout'],
            ]} />
          </section>
          <details className="vt-card px-3 mb-3">
            <summary className="vt-sum">History</summary>
            <ul className="list-unstyled small pb-3 mb-0 d-grid gap-2">
              {o.history.map((h, i) => <li key={i}><strong>{labels[h.status] || h.status}</strong> · {h.by} · {when(h.at)}{h.note && <span className="d-block text-secondary">{h.note}</span>}</li>)}
            </ul>
          </details>
        </div>

        <div className="col-lg-5">
          {!customer && (
            <section className="vt-card p-3 mb-3" aria-label="Handle this order">
              <h2 className="h6 mb-3">Handle this order</h2>
              {o.canPay && <button className="btn btn-primary w-100 mb-3" onClick={() => act(api.patch(`${url}/pay`), 'Marked as paid')}>Mark as paid ({gbp(o.total)})</button>}
              {o.allowed.length > 0 ? (
                <div className="input-group">
                  <select className="form-select" aria-label="Move to" value={next} onChange={(e) => setNext(e.target.value)}>
                    <option value="">Move to…</option>
                    {o.allowed.map((s) => <option key={s} value={s}>{VAPE_STATUSES[s]}</option>)}
                  </select>
                  <button className="btn btn-primary" disabled={!next} onClick={() => act(api.patch(`${url}/status`, { status: next }), 'Status updated')}>Update</button>
                </div>
              ) : <p className="text-secondary mb-0">{o.status === 'ready' && o.paymentStatus !== 'paid' ? 'Mark it as paid before handing it over.' : 'No further status changes.'}</p>}
            </section>
          )}
          {o.canCancel && (
            <button className="btn btn-outline-danger w-100 mb-3" onClick={() => window.confirm('Cancel this order? The items go back into stock.') && act(api.post(`${url}/cancel`), 'Order cancelled')}>Cancel order</button>
          )}
        </div>
      </div>
    </>
  )
}
