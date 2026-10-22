import { useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import useFetch from '../hooks/useFetch'
import { useAuth } from '../context/AuthContext'
import BackLink from '../components/ui/BackLink'
import Facts from '../components/ui/Facts'
import Icon from '../components/ui/Icon'
import Steps from '../components/ui/Steps'
import { EmptyState, ErrorState, Skeleton, StatusPill } from '../components/ui/primitives'
import { DELIVERY_LABELS, PAYMENT_LABELS, ORDER_LABELS, ORDER_CUSTOMER_LABELS, ORDER_TONE, WORKSPACE } from '../constants'
import { gbp, when } from '../format'

// Customer-facing progress, derived from the stored status (collection and delivery end differently).
function progress(o) {
  const delivery = o.deliveryMethod === 'delivery'
  const steps = [
    { label: 'Order placed' },
    { label: 'Being prepared' },
    { label: delivery ? 'On its way to you' : 'Ready to collect', hint: delivery ? undefined : `Collect from ${o.branch.area} and bring your reference.` },
    { label: delivery ? 'Delivered' : 'Collected' },
  ]
  const at = { pending: 0, paid: 0, processing: 1, ready: 2, dispatched: 2, collected: 3, delivered: 3 }[o.status]
  return { steps, current: at, finished: at === 3 }
}

// One detail page for all roles; the server decides which actions are offered.
export default function OrderDetail() {
  const { ref } = useParams()
  const { user } = useAuth()
  const { data: o, loading, error, reload } = useFetch(`/orders/${ref}`)
  const [next, setNext] = useState('')
  const base = WORKSPACE[user.role].home
  const customer = user.role === 'customer'
  const labels = customer ? ORDER_CUSTOMER_LABELS : ORDER_LABELS

  // Runs a request, toasts success, refreshes. Failures are toasted by api.js.
  const act = async (request, msg) => {
    try { await request; toast.success(msg); setNext(''); await reload() } catch { /* toasted by api.js */ }
  }

  if (loading && !o) return <div className="d-grid gap-3"><Skeleton h="4rem" /><Skeleton h="12rem" /></div>
  if (error) {
    return error.response?.status === 404
      ? <EmptyState icon="search" title="We could not find that order" action={<BackLink to={`${base}/orders`}>Back to orders</BackLink>}>Check the reference, or look in your list.</EmptyState>
      : <ErrorState onRetry={reload}>We could not load this order.</ErrorState>
  }
  const url = `/orders/${o.reference}`
  const stopped = o.status === 'cancelled' || o.status === 'refunded'
  const p = progress(o)

  return (
    <>
      <BackLink to={`${base}/orders`}>Orders</BackLink>
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div className="min-w-0"><h1 className="h3 mb-1">{o.reference}</h1><p className="text-secondary mb-0">{when(o.createdAt)}</p></div>
        <StatusPill tone={ORDER_TONE[o.status]}>{labels[o.status]}</StatusPill>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          {customer && (
            <section className="vt-card p-3 mb-3" aria-label="Progress">
              <h2 className="h6 mb-3">Progress</h2>
              {stopped
                ? <div className="alert alert-danger mb-0 d-flex gap-2" role="status"><Icon name="x" size={22} className="flex-none" /><span><strong className="d-block">{labels[o.status]}</strong>{o.paymentStatus === 'refunded' ? 'Your payment has been refunded.' : 'No payment was taken.'}</span></div>
                : <Steps {...p} />}
            </section>
          )}

          <section className="vt-card p-3 mb-3" aria-label="Items">
            <h2 className="h6 mb-3">Items</h2>
            <ul className="list-unstyled d-grid gap-2 mb-3">
              {o.items.map((i) => <li key={i.productId} className="d-flex justify-content-between gap-3"><span>{i.qty} × {i.name}</span><span className="vt-price">{gbp(Math.round(i.price * 100) * i.qty / 100)}</span></li>)}
            </ul>
            {o.loyaltyDiscount > 0 && <p className="d-flex justify-content-between mb-1" style={{ color: 'var(--vt-green-700)' }}><span>Loyalty discount</span><span>-{gbp(o.loyaltyDiscount)}</span></p>}
            <p className="d-flex justify-content-between align-items-baseline border-top pt-3 mb-0"><strong>Total</strong><span className="vt-price" style={{ fontSize: '1.4rem' }}>{gbp(o.total)}</span></p>
          </section>

          <section className="vt-card p-3 mb-3" aria-label="Delivery and payment">
            <h2 className="h6 mb-3">Delivery and payment</h2>
            <Facts items={[
              !customer && ['Customer', `${o.customer.name} · ${o.customer.email}`],
              [o.deliveryMethod === 'delivery' ? 'Sent from' : 'Collect from', o.branch.area],
              ['How', DELIVERY_LABELS[o.deliveryMethod]],
              o.address && ['Address', `${o.address.line1}, ${o.address.city}, ${o.address.postcode}`],
              ['Payment', `${PAYMENT_LABELS[o.paymentMethod].split(' (')[0]} · ${o.paymentStatus === 'paid' ? 'Paid' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Pay on collection'}`],
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
                    {o.allowed.map((s) => <option key={s} value={s}>{ORDER_LABELS[s]}</option>)}
                  </select>
                  <button className="btn btn-primary" disabled={!next} onClick={() => act(api.patch(`${url}/status`, { status: next }), 'Status updated')}>Update</button>
                </div>
              ) : <p className="text-secondary mb-0">No further status changes.</p>}
            </section>
          )}
          {o.canCancel && (
            <button className="btn btn-outline-danger w-100 mb-3" onClick={() => window.confirm('Cancel this order? The items go back into stock and any points you used come back.') && act(api.post(`${url}/cancel`), 'Order cancelled')}>
              Cancel order
            </button>
          )}
          {customer && !o.canCancel && !stopped && <p className="small text-secondary">This order can no longer be cancelled online. Please call the branch.</p>}
        </div>
      </div>
    </>
  )
}
