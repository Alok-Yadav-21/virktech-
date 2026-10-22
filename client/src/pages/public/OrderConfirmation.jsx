import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import useFetch from '../../hooks/useFetch'
import Icon from '../../components/ui/Icon'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'
import { PAYMENT_LABELS } from '../../constants'
import { gbp } from '../../format'

export default function OrderConfirmation() {
  const { ref } = useParams()
  const { data: o, loading, error, reload } = useFetch(`/orders/${ref}`)
  const [copied, setCopied] = useState(false)

  if (loading && !o) return <div className="d-grid gap-3 mx-auto" style={{ maxWidth: 480 }}><Skeleton h="4.5rem" w="4.5rem" circle className="mx-auto" /><Skeleton h="2rem" /><Skeleton h="8rem" /></div>
  if (error) {
    return error.response?.status === 404
      ? <EmptyState icon="search" title="We could not find that order" action={<Link to="/shop" className="btn btn-primary">Back to the shop</Link>}>Check the link, or look in your orders.</EmptyState>
      : <ErrorState onRetry={reload}>We could not load your order.</ErrorState>
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(o.reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Could not copy. Your reference is shown above.') }
  }
  const delivery = o.deliveryMethod === 'delivery'

  return (
    <div className="mx-auto" style={{ maxWidth: 520 }}>
      <div className="text-center mb-4">
        <div className="vt-check"><Icon name="check" size={36} strokeWidth={2.5} /></div>
        <h1 className="h2 mb-1">Order placed</h1>
        <p className="text-secondary mb-3">Thank you. We will get it ready.</p>
        <button type="button" className="btn btn-outline-secondary" onClick={copy} aria-label={`Copy order reference ${o.reference}`}>
          <span className="fw-bold">{o.reference}</span><Icon name={copied ? 'check' : 'copy'} size={18} />{copied ? 'Copied' : ''}
        </button>
      </div>

      <div className="vt-card p-3 p-md-4 mb-3">
        <ul className="list-unstyled d-grid gap-2 mb-3">
          {o.items.map((i) => <li key={i.productId} className="d-flex justify-content-between gap-3"><span>{i.qty} × {i.name}</span><span className="vt-price">{gbp(Math.round(i.price * 100) * i.qty / 100)}</span></li>)}
        </ul>
        {o.loyaltyDiscount > 0 && <p className="d-flex justify-content-between mb-1" style={{ color: 'var(--vt-green-700)' }}><span>Loyalty discount</span><span>-{gbp(o.loyaltyDiscount)}</span></p>}
        <p className="d-flex justify-content-between align-items-baseline border-top pt-3 mb-0"><strong>Total to pay</strong><span className="vt-price" style={{ fontSize: '1.4rem' }}>{gbp(o.total)}</span></p>
      </div>

      <div className="vt-card vt-card--tint p-3 p-md-4 mb-4">
        <h2 className="h6">What happens next</h2>
        <ul className="list-unstyled d-grid gap-2 mb-0">
          <li className="d-flex gap-2"><Icon name="pin" size={20} className="flex-none text-success" />{delivery ? `${o.branch.area} will send it to ${o.address.line1}, ${o.address.city}, ${o.address.postcode}.` : `Collect it from ${o.branch.area}. Bring your reference.`}</li>
          <li className="d-flex gap-2"><Icon name="shield" size={20} className="flex-none text-success" />Pay {delivery ? 'on delivery' : 'on collection'} by {PAYMENT_LABELS[o.paymentMethod].split(' (')[0].toLowerCase()}.</li>
          <li className="d-flex gap-2"><Icon name="receipt" size={20} className="flex-none text-success" />Follow every step under My orders.</li>
        </ul>
      </div>

      <div className="d-grid gap-2">
        <Link className="btn btn-primary btn-lg" to={`/app/orders/${o.reference}`}>Track this order</Link>
        <Link className="btn btn-outline-secondary" to="/shop">Keep shopping</Link>
      </div>
    </div>
  )
}
