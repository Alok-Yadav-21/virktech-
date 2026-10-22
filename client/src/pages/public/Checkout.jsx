import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import { EmptyState, Skeleton } from '../../components/ui/primitives'
import { DELIVERY_LABELS, PAYMENT_LABELS, ROLES, redemption } from '../../constants'
import { gbp } from '../../format'

function Section({ n, title, children }) {
  return (
    <section className="vt-card p-3 p-md-4 mb-3">
      <h2 className="vt-section-title"><span className="vt-dot" aria-hidden="true">{n}</span>{title}</h2>
      {children}
    </section>
  )
}

export default function Checkout() {
  const { user, loading: authLoading, refresh } = useAuth()
  const { items, total, clear } = useCart()
  const { branches, branch: preferred, setBranchId } = useBranch()
  const navigate = useNavigate()
  const [form, setForm] = useState({ branchId: preferred?.id ? String(preferred.id) : '', deliveryMethod: 'collection', paymentMethod: 'cash', line1: '', city: '', postcode: '' })
  const [busy, setBusy] = useState(false)
  const [usePoints, setUsePoints] = useState(false)
  const [stock, setStock] = useState({}) // productId -> { branchId: stock }

  // Fresh points balance once on arrival.
  useEffect(() => { if (user) refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up the saved branch if it arrives after first render.
  useEffect(() => { if (preferred && !form.branchId) setForm((f) => ({ ...f, branchId: String(preferred.id) })) }, [preferred]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stock at each branch for what is in the basket, so a shortfall shows here instead of as a surprise error.
  const key = items.map((i) => i.productId).join(',')
  useEffect(() => {
    let live = true
    Promise.all(items.map((i) => api.get(`/products/${i.productId}/availability`, { quiet: true }).then((r) => [i.productId, Object.fromEntries(r.data.map((b) => [b.branchId, b.stock]))])))
      .then((pairs) => { if (live) setStock(Object.fromEntries(pairs)) })
      .catch(() => { if (live) setStock({}) }) // no stock info: the server still checks when the order is placed
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  if (authLoading) return <div className="text-center py-5"><div className="spinner-border" /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: '/checkout' }} />
  if (user.role !== ROLES.CUSTOMER) return <div className="alert alert-info">Only customer accounts can place orders.</div>
  if (!items.length) return <EmptyState icon="cart" title="Your basket is empty" action={<Link to="/shop" className="btn btn-primary">Browse the shop</Link>}>Add something first, then come back to check out.</EmptyState>

  const delivery = form.deliveryMethod === 'delivery'
  const offer = redemption({ requested: user.loyaltyPoints, balance: user.loyaltyPoints, bill: total })
  const discount = usePoints ? offer.discount : 0
  const chosen = branches.find((b) => String(b.id) === form.branchId)
  const short = form.branchId
    ? items.map((i) => ({ i, have: stock[i.productId]?.[Number(form.branchId)] })).filter((x) => x.have !== undefined && x.have < x.i.qty)
    : []

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.post('/orders', {
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })),
        branchId: Number(form.branchId),
        deliveryMethod: form.deliveryMethod,
        paymentMethod: form.paymentMethod,
        redeemPoints: usePoints ? offer.points : 0,
        address: delivery ? { line1: form.line1, city: form.city, postcode: form.postcode } : undefined,
      })
      setBranchId(Number(form.branchId))
      clear()
      refresh() // balance changed
      navigate(`/order-confirmation/${data.reference}`)
    } catch { /* api.js already toasted the reason (e.g. out of stock) */ } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit}>
      <h1 className="h3 mb-3">Checkout</h1>
      <div className="row g-4">
        <div className="col-lg-7">
          <Section n="1" title="How do you want it?">
            <div className="vt-seg mb-3" role="group" aria-label="Collection or delivery">
              {Object.entries(DELIVERY_LABELS).map(([k, v]) => (
                <button key={k} type="button" aria-pressed={form.deliveryMethod === k} onClick={() => setForm({ ...form, deliveryMethod: k })}>{v}</button>
              ))}
            </div>
            <label className="form-label" htmlFor="branch">{delivery ? 'Branch that will send it' : 'Collect from'}</label>
            <select id="branch" className="form-select" required value={form.branchId} onChange={set('branchId')}>
              <option value="">Choose a branch…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.area} · {b.address}</option>)}
            </select>
            {chosen && <p className="small text-secondary mt-2 mb-0 d-flex gap-1"><Icon name="pin" size={16} className="flex-none" />{chosen.name}, {chosen.address}, {chosen.postcode}</p>}
            {short.length > 0 && (
              <div className="alert alert-warning mt-3 mb-0" role="alert">
                <strong>Not enough stock at {chosen?.area}:</strong>
                <ul className="mb-1 ps-3">{short.map(({ i, have }) => <li key={i.productId}>{i.name}: {have === 0 ? 'out of stock' : `only ${have} left`}</li>)}</ul>
                Pick another branch, or change your basket.
              </div>
            )}
          </Section>

          {delivery && (
            <Section n="2" title="Delivery address">
              <div className="d-grid gap-3">
                <div><label className="form-label" htmlFor="line1">Address line 1</label><input id="line1" className="form-control" required autoComplete="address-line1" value={form.line1} onChange={set('line1')} /></div>
                <div className="row g-3">
                  <div className="col-sm-6"><label className="form-label" htmlFor="city">City</label><input id="city" className="form-control" required autoComplete="address-level2" value={form.city} onChange={set('city')} /></div>
                  <div className="col-sm-6"><label className="form-label" htmlFor="postcode">Postcode</label><input id="postcode" className="form-control" required autoComplete="postal-code" value={form.postcode} onChange={set('postcode')} /></div>
                </div>
              </div>
            </Section>
          )}

          <Section n={delivery ? '3' : '2'} title={`How will you pay ${delivery ? 'on delivery' : 'on collection'}?`}>
            <div className="d-grid gap-2">
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <label key={k} className="vt-choice">
                  <input type="radio" name="payment" className="form-check-input mt-0" checked={form.paymentMethod === k} onChange={() => setForm({ ...form, paymentMethod: k })} />
                  <span className="fw-semibold">{v}</span>
                </label>
              ))}
            </div>
            <p className="small text-secondary mt-2 mb-0 d-flex gap-2"><Icon name="shield" size={18} className="flex-none text-success" />Nothing is charged online. You pay in person.</p>
          </Section>

          {offer.points > 0 && (
            <Section n={delivery ? '4' : '3'} title="Loyalty points">
              <label className="vt-choice">
                <input type="checkbox" className="form-check-input mt-0" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
                <span><strong className="d-block">Use {offer.points} points for {gbp(offer.discount)} off</strong><span className="small text-secondary">You have {user.loyaltyPoints} points. Up to 20% of an order can be paid with points.</span></span>
              </label>
            </Section>
          )}
        </div>

        <div className="col-lg-5">
          <div className="vt-card p-3 p-md-4 position-sticky" style={{ top: '5rem' }}>
            <h2 className="h5 mb-3">Your order</h2>
            <ul className="list-unstyled d-grid gap-2 mb-3">
              {items.map((i) => (
                <li key={i.productId} className="d-flex gap-3 align-items-center">
                  <span className="vt-line-img flex-none" style={{ width: '3.25rem' }}><img src={i.image} alt="" width="104" height="104" loading="lazy" /></span>
                  <span className="me-auto small">{i.qty} × {i.name}</span>
                  <span className="vt-price small">{gbp(Math.round(i.price * 100) * i.qty / 100)}</span>
                </li>
              ))}
            </ul>
            {discount > 0 && <p className="d-flex justify-content-between mb-1" style={{ color: 'var(--vt-green-700)' }}><span>Loyalty discount</span><span>-{gbp(discount)}</span></p>}
            <p className="d-flex justify-content-between align-items-baseline mb-0"><strong>Total to pay</strong><span className="vt-price" style={{ fontSize: '1.5rem' }}>{gbp(total - discount)}</span></p>
            <button className="btn btn-primary btn-lg w-100 mt-3 d-none d-md-inline-flex" disabled={busy || short.length > 0}>{busy ? 'Placing order…' : 'Place order'}</button>
          </div>
        </div>
      </div>

      <div className="d-md-none" style={{ height: '4.5rem' }} aria-hidden="true" />
      <div className="vt-bar d-md-none" role="region" aria-label="Place order">
        <div className="container d-flex align-items-center gap-3">
          <div className="lh-sm"><small className="text-secondary d-block">Total to pay</small>{busy ? <Skeleton h="1.5rem" w="5rem" /> : <span className="vt-price" style={{ fontSize: '1.3rem' }}>{gbp(total - discount)}</span>}</div>
          <button className="btn btn-primary btn-lg ms-auto flex-grow-1" disabled={busy || short.length > 0}>{busy ? 'Placing order…' : 'Place order'}</button>
        </div>
      </div>
    </form>
  )
}
