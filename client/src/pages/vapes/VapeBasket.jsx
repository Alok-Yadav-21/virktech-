import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import api from '../../api'
import { useAuth } from '../../context/AuthContext'
import { useVapeCart } from '../../context/VapeCartContext'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import AgeGate from '../../components/vapes/AgeGate'
import { VapeImage } from '../../components/vapes/VapeCard'
import { EmptyState, QtyStepper } from '../../components/ui/primitives'
import { PAYMENT_LABELS, ROLES } from '../../constants'
import { nicotineLabel } from '../../vapeConstants'
import { gbp } from '../../format'

// Basket and checkout on one page: vapes are collection only, so there is no delivery step.
export default function VapeBasket() {
  const { user, loading: authLoading } = useAuth()
  const { items, setQty, remove, total, clear } = useVapeCart()
  const { branches, branch: preferred, setBranchId } = useBranch()
  const navigate = useNavigate()
  const [branchId, setBranch] = useState(preferred?.id ? String(preferred.id) : '')
  const [paymentMethod, setPayment] = useState('cash')
  const [age, setAge] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stock, setStock] = useState({}) // productId -> { branchId: stock }

  useEffect(() => { if (preferred && !branchId) setBranch(String(preferred.id)) }, [preferred]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stock at each branch for what is in the basket, so a shortfall shows here instead of as a surprise error.
  const key = items.map((i) => i.productId).join(',')
  useEffect(() => {
    let live = true
    Promise.all(items.map((i) => api.get(`/vapes/products/${i.productId}/availability`, { quiet: true }).then((r) => [i.productId, Object.fromEntries(r.data.map((b) => [b.branchId, b.stock]))])))
      .then((pairs) => { if (live) setStock(Object.fromEntries(pairs)) })
      .catch(() => { if (live) setStock({}) }) // no stock info: the server still checks when the order is placed
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) return <div className="text-center py-5"><div className="spinner-border" /></div>
  if (!items.length) return <EmptyState icon="cart" title="Your vape basket is empty" action={<Link to="/vapes" className="btn btn-primary">Browse vapes</Link>}>Add something and it will wait for you here.</EmptyState>
  if (user && user.role !== ROLES.CUSTOMER) return <div className="alert alert-info">Only customer accounts can place orders.</div>

  const short = branchId ? items.map((i) => ({ i, have: stock[i.productId]?.[Number(branchId)] })).filter((x) => x.have !== undefined && x.have < x.i.qty) : []
  const ready = branchId && age && !short.length

  const place = async () => {
    if (!user) return navigate('/login', { state: { from: '/vapes/basket' } })
    setBusy(true)
    try {
      const { data } = await api.post('/vapes/orders', {
        items: items.map((i) => ({ productId: i.productId, qty: i.qty })), branchId: Number(branchId), paymentMethod, ageConfirmed: age,
      })
      setBranchId(Number(branchId))
      clear()
      navigate(`/app/vape-orders/${data.reference}`, { replace: true, state: { placed: true } })
    } catch { /* api.js toasted the reason (e.g. not enough stock) */ } finally { setBusy(false) }
  }

  return (
    <>
      <AgeGate />
      <h1 className="h3 mb-3">Vape basket</h1>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="vt-card px-3">
            {items.map((i) => (
              <div key={i.productId} className="vt-line">
                <Link to={`/vapes/${i.productId}`} className="vt-line-img" aria-hidden="true" tabIndex={-1}><VapeImage p={i} width="176" height="176" loading="lazy" /></Link>
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex justify-content-between gap-2">
                    <Link to={`/vapes/${i.productId}`} className="text-body text-decoration-none">{i.brand} {i.name}{i.flavour && <span className="d-block small text-secondary">{i.flavour} · {nicotineLabel(i.nicotineMg)}</span>}</Link>
                    <span className="vt-price flex-none">{gbp(Math.round(i.price * 100) * i.qty / 100)}</span>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <QtyStepper value={i.qty} max={Math.max(1, i.stock)} onChange={(n) => setQty(i.productId, n)} label={`Quantity of ${i.name}`} />
                    <button type="button" className="btn btn-link text-danger d-inline-flex align-items-center gap-1 px-2" onClick={() => remove(i.productId)}><Icon name="trash" size={18} />Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-lg-5">
          <section className="vt-card p-3 mb-3">
            <h2 className="h6 mb-3">Collect from</h2>
            <select className="form-select" aria-label="Collection branch" value={branchId} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Choose a branch…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.area}</option>)}
            </select>
            {short.length > 0 && (
              <div className="alert alert-warning mt-3 mb-0" role="alert">
                <strong className="d-block">Not enough stock at {branches.find((b) => String(b.id) === branchId)?.area}</strong>
                {short.map(({ i, have }) => <span key={i.productId} className="d-block">{i.name}: {have} available, you have {i.qty}</span>)}
                Lower the quantity or choose another branch.
              </div>
            )}
            <h2 className="h6 mt-4 mb-2">How you will pay</h2>
            {Object.entries(PAYMENT_LABELS).map(([v, label]) => (
              <label key={v} className="vt-choice mb-2"><input type="radio" className="form-check-input mt-0" name="pay" checked={paymentMethod === v} onChange={() => setPayment(v)} /><span>{label.split(' (')[0]} at the counter</span></label>
            ))}
          </section>

          <section className="vt-card vt-card--attention p-3 mb-3">
            <label className="d-flex gap-3 align-items-start mb-0">
              <input type="checkbox" className="form-check-input mt-1 flex-none" checked={age} onChange={(e) => setAge(e.target.checked)} />
              <span><strong className="d-block">I am 18 or over</strong>Bring photo ID when you collect. We cannot hand over vaping products without it.</span>
            </label>
          </section>

          <div className="vt-card p-3">
            <p className="d-flex justify-content-between align-items-baseline mb-3"><strong>Total</strong><span className="vt-price" style={{ fontSize: '1.4rem' }}>{gbp(total)}</span></p>
            {!user && <p className="small text-secondary">You will be asked to log in or register first. Your basket is saved.</p>}
            <button className="btn btn-primary btn-lg w-100" disabled={!ready || busy} onClick={place}>{busy ? 'Placing order…' : user ? 'Place order' : 'Log in to order'}</button>
            {!age && <p className="small text-secondary mt-2 mb-0">Confirm you are 18 or over to continue.</p>}
          </div>
        </div>
      </div>
    </>
  )
}
