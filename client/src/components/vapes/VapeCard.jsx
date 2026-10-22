import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import Icon from '../ui/Icon'
import { Price } from '../ui/primitives'
import { useVapeCart } from '../../context/VapeCartContext'
import { nicotineLabel } from '../../vapeConstants'

// A photo, or a quiet tile when the product has none yet.
export function VapeImage({ p, ...rest }) {
  return p.image
    ? <img src={p.image} alt={p.name} width="400" height="300" {...rest} />
    : <span className="d-grid h-100 w-100 text-secondary" style={{ placeItems: 'center' }} aria-hidden="true"><Icon name="drop" size={40} /></span>
}

// Same card as the electronics shop, with the vape details: brand, flavour, strength.
export default function VapeCard({ p }) {
  const { add } = useVapeCart()
  const out = p.stockTotal < 1
  return (
    <div className="vt-card vt-product">
      <Link to={`/vapes/${p.id}`} className="d-flex flex-column flex-grow-1 text-body text-decoration-none">
        <div className="vt-product-img">
          <VapeImage p={p} loading="lazy" decoding="async" />
          <span className="vt-tag">{nicotineLabel(p.nicotineMg)}</span>
        </div>
        <div className="vt-product-body">
          <span className="small text-secondary">{p.brand}</span>
          <span className="vt-product-name">{p.name}</span>
          {p.flavour && <span className="small text-secondary">{p.flavour}</span>}
          <Price price={p.price} was={p.wasPrice} />
          {out
            ? <span className="small text-secondary">Out of stock</span>
            : p.stockTotal <= 3 && <span className="small" style={{ color: 'var(--vt-coral)' }}>Only {p.stockTotal} left</span>}
        </div>
      </Link>
      <div className="vt-product-media">
        <button type="button" className="vt-product-add" disabled={out} aria-label={out ? `${p.name} is out of stock` : `Add ${p.name} to basket`}
          onClick={() => { add(p); toast.success('Added to vape basket') }}>
          <Icon name="plus" size={22} />
        </button>
      </div>
    </div>
  )
}
