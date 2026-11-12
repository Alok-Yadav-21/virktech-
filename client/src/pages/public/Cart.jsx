import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import Icon from '../../components/ui/Icon'
import { EmptyState, QtyStepper } from '../../components/ui/primitives'
import { gbp } from '../../format'

export default function Cart() {
  const { items, setQty, remove, total, count } = useCart()

  if (!items.length) {
    return (
      <EmptyState icon="cart" title="Your basket is empty" action={<Link to="/shop" className="btn btn-primary">Browse the shop</Link>}>
        Add something and it will wait for you here.
      </EmptyState>
    )
  }

  return (
    <>
      <h1 className="h3 mb-3">Basket <span className="text-secondary fw-normal fs-6">({count} {count === 1 ? 'item' : 'items'})</span></h1>
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="vt-card px-3">
            {items.map((i) => (
              <div key={i.productId} className="vt-line">
                <Link to={`/shop/${i.productId}`} className="vt-line-img" aria-hidden="true" tabIndex={-1}><img src={i.image} alt="" width="176" height="176" loading="lazy" /></Link>
                <div className="d-flex flex-column gap-2 min-w-0">
                  <div className="d-flex justify-content-between gap-2">
                    <Link to={`/shop/${i.productId}`} className="fw-semibold text-body text-decoration-none text-break">{i.name}</Link>
                    <span className="vt-price flex-none">{gbp(Math.round(i.price * 100) * i.qty / 100)}</span>
                  </div>
                  <span className="small text-secondary">{gbp(i.price)} each</span>
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-1">
                    <QtyStepper value={i.qty} max={Math.max(1, i.stock)} onChange={(n) => setQty(i.productId, n)} label={`Quantity of ${i.name}`} />
                    <button type="button" className="btn btn-link text-danger d-inline-flex align-items-center gap-1 px-2" onClick={() => remove(i.productId)} aria-label={`Remove ${i.name}`}>
                      <Icon name="trash" size={18} />Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="vt-card p-3 d-none d-lg-block position-sticky" style={{ top: '5rem' }}>
            <Summary total={total} count={count} />
            <Link to="/checkout" className="btn btn-primary btn-lg w-100 mt-3">Checkout</Link>
          </div>
          <div className="d-lg-none"><Summary total={total} count={count} compact /></div>
        </div>
      </div>

      <div className="d-md-none" style={{ height: '4.5rem' }} aria-hidden="true" />
      <div className="vt-bar d-lg-none" role="region" aria-label="Checkout">
        <div className="container d-flex align-items-center gap-3">
          <div className="lh-sm flex-none"><small className="text-secondary d-block">Total</small><span className="vt-price" style={{ fontSize: '1.3rem' }}>{gbp(total)}</span></div>
          <Link to="/checkout" className="btn btn-primary btn-lg ms-auto flex-grow-1 min-w-0">Checkout<Icon name="arrow" size={20} /></Link>
        </div>
      </div>
    </>
  )
}

function Summary({ total, count, compact }) {
  return (
    <div className={compact ? 'small text-secondary px-1' : ''}>
      {!compact && <h2 className="h5">Order summary</h2>}
      <div className="d-flex justify-content-between"><span>{count} {count === 1 ? 'item' : 'items'}</span><span>{gbp(total)}</span></div>
      <p className="mb-0 mt-2 d-flex gap-2"><Icon name="shield" size={18} className="flex-none text-success" />You pay when you collect or when it arrives. Final prices are confirmed when you place the order.</p>
    </div>
  )
}
