import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import useFetch from '../../hooks/useFetch'
import { useCart } from '../../context/CartContext'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import ProductCard from '../../components/ui/ProductCard'
import { EmptyState, ErrorState, Price, SectionHead, Skeleton } from '../../components/ui/primitives'
import { gbp } from '../../format'

function Availability({ rows, branch, openPicker }) {
  if (!rows) return <Skeleton h="1.25rem" w="60%" />
  const here = branch && rows.find((r) => r.branchId === branch.id)
  const elsewhere = rows.filter((r) => r.stock > 0 && r.branchId !== branch?.id)
  const withStock = rows.filter((r) => r.stock > 0).length
  let tone = withStock ? 'text-success' : 'text-danger'
  let text = withStock ? `In stock at ${withStock} of ${rows.length} branches` : 'Out of stock at every branch'
  let icon = withStock ? 'check' : 'x'
  if (here) {
    if (here.stock > 3) { tone = 'text-success'; text = `In stock at ${here.area}`; icon = 'check' }
    else if (here.stock > 0) { tone = 'text-danger'; text = `Only ${here.stock} left at ${here.area}`; icon = 'alert' }
    else { tone = 'text-danger'; text = `Out of stock at ${here.area}`; icon = 'x' }
  }
  return (
    <div>
      <p className={`d-flex align-items-center gap-2 fw-semibold mb-1 ${tone}`}><Icon name={icon} size={20} />{text}</p>
      {here?.stock === 0 && elsewhere.length > 0 && <p className="small mb-1">Available at {elsewhere.slice(0, 3).map((r) => r.area).join(', ')}{elsewhere.length > 3 ? ` and ${elsewhere.length - 3} more` : ''}.</p>}
      <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={openPicker}><Icon name="pin" size={16} />{branch ? 'Change branch' : 'Check my branch'}</button>
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, add } = useCart()
  const { branch, openPicker } = useBranch()
  const { data: p, loading, error, reload } = useFetch(`/products/${id}`)
  const { data: rows } = useFetch(`/products/${id}/availability`)
  const { data: all } = useFetch('/products')

  if (loading && !p) {
    return <div className="d-grid gap-3"><Skeleton h="16rem" /><Skeleton h="2rem" w="70%" /><Skeleton h="1.5rem" w="40%" /></div>
  }
  if (error) {
    return error.response?.status === 404
      ? <EmptyState icon="search" title="We could not find that product" action={<Link className="btn btn-primary" to="/shop">Back to the shop</Link>}>It may have been removed.</EmptyState>
      : <ErrorState onRetry={reload}>We could not load this product.</ErrorState>
  }

  const out = p.stockTotal < 1
  const saving = p.wasPrice > p.price ? p.wasPrice - p.price : 0
  const related = (all || []).filter((x) => x.category === p.category && x.id !== p.id).slice(0, 8)
  const inBasket = items.some((i) => i.productId === p.id)
  const addToBasket = () => { add(p); toast.success('Added to basket') }
  const buyNow = () => { if (!inBasket) add(p); navigate('/checkout') }

  return (
    <>
      <nav aria-label="Breadcrumb" className="small mb-2">
        <Link to="/shop">Shop</Link> <span className="text-secondary">/</span> <Link to={`/shop?category=${encodeURIComponent(p.category)}`}>{p.category}</Link>
      </nav>
      <div className="row g-4">
        <div className="col-md-6">
          <div className="vt-bleed"><div className="vt-gallery"><img src={p.image} alt={p.name} width="1200" height="900" fetchpriority="high" /></div></div>
        </div>
        <div className="col-md-6">
          <p className="text-secondary mb-1">{p.brand} · <span className="vt-pill vt-pill--brand">{p.condition}</span></p>
          <h1 className="h2 mb-2">{p.name}</h1>
          <div className="mb-1"><Price price={p.price} was={p.wasPrice} size="1.9rem" /></div>
          {saving > 0 && <p className="fw-semibold mb-3" style={{ color: 'var(--vt-green-700)' }}>You save {gbp(saving)}</p>}

          <div className="vt-card p-3 mb-3">
            <Availability rows={rows} branch={branch} openPicker={openPicker} />
          </div>

          <p className="mb-3">{p.description}</p>

          <ul className="list-unstyled d-grid gap-2 mb-4 small">
            <li className="d-flex gap-2"><Icon name="shield" size={20} className="flex-none text-success" />Pay when you collect it or when it arrives. Nothing is charged online.</li>
            <li className="d-flex gap-2"><Icon name="gift" size={20} className="flex-none text-success" />Earn loyalty points once your order is collected or delivered.</li>
          </ul>

          {rows && (
            <details className="mb-4">
              <summary className="vt-sum">Stock at every branch</summary>
              <ul className="list-unstyled small mb-0">
                {rows.map((r) => (
                  <li key={r.branchId} className="d-flex justify-content-between py-1 border-bottom">
                    <span>{r.area}</span><span className={r.stock > 0 ? '' : 'text-secondary'}>{r.stock > 3 ? 'In stock' : r.stock > 0 ? `Only ${r.stock} left` : 'Out of stock'}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-4" aria-labelledby="related-title">
          <SectionHead title={<span id="related-title">More in {p.category}</span>} to={`/shop?category=${encodeURIComponent(p.category)}`} />
          <div className="vt-rail">{related.map((r) => <div key={r.id} className="vt-productwrap"><ProductCard p={r} /></div>)}</div>
        </section>
      )}

      <div className="d-md-none" style={{ height: '4.5rem' }} aria-hidden="true" />
      <div className="vt-bar" role="region" aria-label="Buy">
        <div className="container d-flex align-items-center gap-2">
          <div className="me-auto lh-sm d-md-none"><span className="vt-price d-block" style={{ fontSize: '1.2rem' }}>{gbp(p.price)}</span>{saving > 0 && <small className="text-secondary text-decoration-line-through">{gbp(p.wasPrice)}</small>}</div>
          <button className="btn btn-outline-primary px-3" disabled={out} onClick={addToBasket}>{out ? 'Out of stock' : inBasket ? 'Add another' : 'Add to basket'}</button>
          <button className="btn btn-primary px-3" disabled={out} onClick={buyNow}>Buy now</button>
        </div>
      </div>
    </>
  )
}
