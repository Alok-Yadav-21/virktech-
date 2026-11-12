import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import Icon from '../../components/ui/Icon'
import AgeGate from '../../components/vapes/AgeGate'
import VapeCard from '../../components/vapes/VapeCard'
import { ProductCardSkeleton } from '../../components/ui/ProductCard'
import { Chip, EmptyState, ErrorState, Sheet } from '../../components/ui/primitives'
import { useVapeCart } from '../../context/VapeCartContext'
import { VAPE_KINDS, FLAVOUR_GROUPS, nicotineLabel } from '../../vapeConstants'
import { SORTS } from '../../constants'

// Filters live in the address bar, like the electronics shop. Everything here is the vape range only.
export default function VapeShop() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const { count } = useVapeCart()
  const products = useFetch('/vapes/products')
  const brands = useFetch('/vapes/brands')

  const q = params.get('q') || ''
  const brand = params.get('brand') || ''
  const kinds = (params.get('kind') || '').split(',').filter(Boolean)
  const groups = (params.get('flavour') || '').split(',').filter(Boolean)
  const strengths = (params.get('nic') || '').split(',').filter(Boolean)
  const sort = params.get('sort') || 'featured'
  const inStock = params.get('instock') === '1'

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value == null || value === false) next.delete(key)
    else next.set(key, value === true ? '1' : value)
    setParams(next, { replace: true })
  }
  const toggle = (key, list, v) => set(key, (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(','))
  const activeCount = kinds.length + groups.length + strengths.length + (inStock ? 1 : 0)

  const all = products.data || []
  const nicOptions = [...new Set(all.map((p) => p.nicotineMg))].sort((a, b) => a - b)
  const term = q.trim().toLowerCase()
  const shown = all
    .filter((p) => (!brand || p.brand === brand)
      && (!term || `${p.name} ${p.brand} ${p.flavour || ''} ${p.kind}`.toLowerCase().includes(term))
      && (!kinds.length || kinds.includes(p.kind))
      && (!groups.length || groups.includes(p.flavourGroup))
      && (!strengths.length || strengths.includes(String(p.nicotineMg)))
      && (!inStock || p.stockTotal > 0))
    .sort((a, b) => (sort === 'price-asc' ? a.price - b.price : sort === 'price-desc' ? b.price - a.price : 0))

  return (
    <>
      <AgeGate />
      <div className="d-flex align-items-baseline justify-content-between gap-3">
        <h1 className="h3 mb-0">{brand || 'Vapes'} <span className="vt-pill vt-pill--warn align-middle ms-1">18+</span></h1>
        <span className="d-flex align-items-center gap-3">
          {products.data && <span className="text-secondary small" aria-live="polite">{shown.length} {shown.length === 1 ? 'product' : 'products'}</span>}
          <Link to="/vapes/basket" className="btn btn-sm btn-outline-primary"><Icon name="cart" size={18} />Basket{count > 0 && ` (${count})`}</Link>
        </span>
      </div>
      <p className="text-secondary small mt-1 mb-0">For adults only. Collect in store and pay at the counter; we check ID on collection.</p>

      <div className="vt-filterbar">
        <div className="vt-rail" role="group" aria-label="Brands">
          <Chip active={!brand} onClick={() => set('brand', '')}>All brands</Chip>
          {brands.data?.map((b) => <Chip key={b.id} active={brand === b.name} onClick={() => set('brand', b.name)}>{b.name}</Chip>)}
        </div>
        <div className="d-flex gap-2 pb-2">
          <button type="button" className="vt-chip" onClick={() => setOpen(true)}>
            <Icon name="sliders" size={18} />Filters{activeCount > 0 && <span className="vt-count vt-count--inline" style={{ background: 'var(--vt-green-600)' }}>{activeCount}</span>}
          </button>
          <input type="search" className="form-control" style={{ minHeight: 44, borderRadius: 999, minWidth: 0 }} placeholder="Search flavour or brand" aria-label="Search vapes" value={q} onChange={(e) => set('q', e.target.value)} />
          <select className="form-select w-auto d-none d-sm-block" style={{ minHeight: 44, borderRadius: 999 }} aria-label="Sort by" value={sort} onChange={(e) => set('sort', e.target.value === 'featured' ? '' : e.target.value)}>
            {SORTS.filter(([v]) => ['featured', 'price-asc', 'price-desc'].includes(v)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-2">
        {products.error && <ErrorState onRetry={products.reload}>We could not load the vape range just now.</ErrorState>}
        {products.loading && !products.data && (
          <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2 g-md-3">
            {Array.from({ length: 8 }, (_, i) => <div className="col" key={i}><ProductCardSkeleton /></div>)}
          </div>
        )}
        {products.data && !shown.length && (
          <EmptyState icon="search" title={all.length ? 'Nothing matches that' : 'No vapes in the shop yet'} action={all.length ? <button className="btn btn-primary" onClick={() => setParams({}, { replace: true })}>Clear search and filters</button> : null}>
            {all.length ? 'Try a different word, or remove a filter.' : 'Please check back soon.'}
          </EmptyState>
        )}
        {shown.length > 0 && (
          <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2 g-md-3">
            {shown.map((p) => <div className="col" key={p.id}><VapeCard p={p} /></div>)}
          </div>
        )}
      </div>

      <Sheet show={open} onHide={() => setOpen(false)} title="Filters"
        footer={(
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={() => setParams(q ? { q } : {}, { replace: true })} disabled={!activeCount}>Clear</button>
            <button className="btn btn-primary flex-grow-1" onClick={() => setOpen(false)}>Show {shown.length} {shown.length === 1 ? 'product' : 'products'}</button>
          </div>
        )}>
        <fieldset className="mb-4">
          <legend className="h6">Type</legend>
          <div className="d-flex flex-wrap gap-2">{VAPE_KINDS.map((k) => <Chip key={k} active={kinds.includes(k)} onClick={() => toggle('kind', kinds, k)}>{k}</Chip>)}</div>
        </fieldset>
        <fieldset className="mb-4">
          <legend className="h6">Flavour</legend>
          <div className="d-flex flex-wrap gap-2">{FLAVOUR_GROUPS.map((g) => <Chip key={g} active={groups.includes(g)} onClick={() => toggle('flavour', groups, g)}>{g}</Chip>)}</div>
        </fieldset>
        <fieldset className="mb-4">
          <legend className="h6">Nicotine strength</legend>
          <div className="d-flex flex-wrap gap-2">{nicOptions.map((n) => <Chip key={n} active={strengths.includes(String(n))} onClick={() => toggle('nic', strengths, String(n))}>{nicotineLabel(n)}</Chip>)}</div>
        </fieldset>
        <div className="form-check form-switch d-flex align-items-center gap-3 ps-0">
          <input id="v-stock" className="form-check-input ms-0 flex-none" type="checkbox" role="switch" checked={inStock} onChange={(e) => set('instock', e.target.checked)} />
          <label htmlFor="v-stock" className="form-check-label">In stock only</label>
        </div>
      </Sheet>
    </>
  )
}
