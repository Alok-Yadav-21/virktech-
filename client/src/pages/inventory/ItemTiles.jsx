import { useState } from 'react'
import useFetch from '../../hooks/useFetch'
import useDebounce from '../../hooks/useDebounce'
import Icon from '../../components/ui/Icon'
import { EmptyState, ErrorState } from '../../components/ui/primitives'

// Step 3: photo tiles for one category. Tap a tile to put one on the list; the green number shows how many are on it.
// `counts` is { productId: qty } from the list being built.
export default function ItemTiles({ kind, sub, counts, onPick }) {
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim())
  const items = useFetch(`/branch/items?limit=60&kind=${kind}${sub ? `&sub=${encodeURIComponent(sub)}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`)

  return (
    <>
      <input className="form-control form-control-lg mb-3" type="search" placeholder="Type a name to find it" aria-label="Find an item by name" value={q} onChange={(e) => setQ(e.target.value)} />
      {items.error && <ErrorState onRetry={items.reload}>We could not load the items.</ErrorState>}
      {items.data && !items.data.length && <EmptyState icon="info" title="Nothing here">Try another name, or go back and pick another kind.</EmptyState>}
      <div className="row g-2">
        {items.data?.map((i) => (
          <div key={i.id} className="col-6 col-md-4 col-lg-3">
            <button type="button" className="vt-card w-100 h-100 p-2 border text-start position-relative" onClick={() => onPick(i)}>
              {counts[i.id] > 0 && <span className="badge bg-success position-absolute top-0 end-0 m-2 fs-6">+{counts[i.id]}</span>}
              <span className="d-grid mb-2 bg-light rounded" style={{ placeItems: 'center', height: '5.5rem' }}>
                {i.image ? <img src={i.image} alt="" className="rounded" style={{ maxHeight: '5.5rem', maxWidth: '100%', objectFit: 'contain' }} /> : <Icon name="box" size={36} />}
              </span>
              <strong className="d-block lh-sm">{i.name}</strong>
              {i.detail && <span className="d-block small text-secondary">{i.detail}</span>}
              {i.barcode && <span className="d-block small text-secondary font-monospace">{i.barcode}</span>}
              <span className={`d-block small mt-1 ${i.stock <= 3 ? 'text-danger fw-semibold' : 'text-secondary'}`}>{i.stock} in stock</span>
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
