import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import Icon from './Icon'
import { Price } from './primitives'
import { useCart } from '../../context/CartContext'

// One product, used in the shop grid, home rails and related items. The add button sits beside the link
// (not inside it) so there is never a button nested in a link.
export default function ProductCard({ p, className = '' }) {
  const { add } = useCart()
  const out = p.stockTotal < 1
  return (
    <div className={`vt-card vt-product ${className}`}>
      <Link to={`/shop/${p.id}`} className="d-flex flex-column flex-grow-1 text-body text-decoration-none">
        <div className="vt-product-img">
          <img src={p.image} alt={p.name} width="400" height="300" loading="lazy" decoding="async" />
          <span className="vt-tag">{p.condition}</span>
        </div>
        <div className="vt-product-body">
          <span className="vt-product-name">{p.name}</span>
          <Price price={p.price} was={p.wasPrice} />
          {out
            ? <span className="small text-secondary">Out of stock</span>
            : p.stockTotal <= 3 && <span className="small fw-semibold" style={{ color: 'var(--vt-coral)' }}>Only {p.stockTotal} left</span>}
        </div>
      </Link>
      {/* Same box as the photo, so the button sits on the picture and never over the price */}
      <div className="vt-product-media" aria-hidden={false}>
        <button
          type="button" className="vt-product-add" disabled={out} aria-label={out ? `${p.name} is out of stock` : `Add ${p.name} to basket`}
          onClick={() => { add(p); toast.success('Added to basket') }}
        >
          <Icon name="plus" size={22} />
        </button>
      </div>
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="vt-card">
      <span className="vt-skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
      <div className="p-3 d-grid gap-2">
        <span className="vt-skeleton" style={{ height: 14, width: '90%' }} />
        <span className="vt-skeleton" style={{ height: 14, width: '60%' }} />
        <span className="vt-skeleton" style={{ height: 18, width: '40%' }} />
      </div>
    </div>
  )
}
