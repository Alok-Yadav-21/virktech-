import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import Icon from '../../components/ui/Icon'
import ProductCard, { ProductCardSkeleton } from '../../components/ui/ProductCard'
import { Chip, EmptyState, ErrorState, Sheet } from '../../components/ui/primitives'
import { CONDITIONS, PRICE_BANDS, SORTS } from '../../constants'

const bandOk = (price, band) => {
  if (!band) return true
  const [lo, hi] = band.split('-')
  return price >= Number(lo) && (hi === '' || price < Number(hi))
}

// Filters live in the address bar, so a filtered view can be shared or reached with the back button.
export default function Shop() {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const products = useFetch('/products')
  const categories = useFetch('/categories')

  const q = params.get('q') || ''
  const category = params.get('category') || ''
  const conditions = (params.get('condition') || '').split(',').filter(Boolean)
  const band = params.get('price') || ''
  const sort = params.get('sort') || 'featured'
  const deals = params.get('deals') === '1'
  const inStock = params.get('instock') === '1'

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (value === '' || value == null || value === false) next.delete(key)
    else next.set(key, value === true ? '1' : value)
    setParams(next, { replace: true })
  }
  const toggleCondition = (c) => set('condition', (conditions.includes(c) ? conditions.filter((x) => x !== c) : [...conditions, c]).join(','))
  const clearAll = () => setParams(q ? { q } : {}, { replace: true })
  const activeCount = conditions.length + (band ? 1 : 0) + (deals ? 1 : 0) + (inStock ? 1 : 0)

  const all = products.data || []
  const term = q.trim().toLowerCase()
  const shown = all
    .filter((p) => (!category || p.category === category)
      && (!term || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(term))
      && (!conditions.length || conditions.includes(p.condition))
      && bandOk(p.price, band)
      && (!deals || p.wasPrice > p.price)
      && (!inStock || p.stockTotal > 0))
    .sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price
      if (sort === 'price-desc') return b.price - a.price
      if (sort === 'saving') return (b.wasPrice ? 1 - b.price / b.wasPrice : 0) - (a.wasPrice ? 1 - a.price / a.wasPrice : 0)
      return 0
    })

  return (
    <>
      <div className="d-flex align-items-baseline justify-content-between gap-3">
        <h1 className="h3 mb-0">{q ? `Results for "${q}"` : category || 'Shop'}</h1>
        {products.data && <span className="text-secondary small" aria-live="polite">{shown.length} {shown.length === 1 ? 'product' : 'products'}</span>}
      </div>

      <div className="vt-filterbar">
        <div className="vt-rail" role="group" aria-label="Categories">
          <Chip active={!category} onClick={() => set('category', '')}>All</Chip>
          {categories.data?.map((c) => <Chip key={c.id} active={category === c.name} onClick={() => set('category', c.name)}>{c.name}</Chip>)}
        </div>
        <div className="d-flex gap-2 pb-2">
          <button type="button" className="vt-chip" onClick={() => setOpen(true)}>
            <Icon name="sliders" size={18} />Filters{activeCount > 0 && <span className="vt-count vt-count--inline" style={{ background: 'var(--vt-green-600)' }}>{activeCount}</span>}
          </button>
          <select className="form-select w-auto flex-grow-1 flex-md-grow-0" style={{ minHeight: 44, borderRadius: 999, minWidth: 0, maxWidth: '100%' }} aria-label="Sort by" value={sort} onChange={(e) => set('sort', e.target.value === 'featured' ? '' : e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-2">
        {products.error && <ErrorState onRetry={products.reload}>We could not load the shop just now.</ErrorState>}
        {products.loading && !products.data && (
          <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2 g-md-3">
            {Array.from({ length: 8 }, (_, i) => <div className="col" key={i}><ProductCardSkeleton /></div>)}
          </div>
        )}
        {products.data && !shown.length && (
          <EmptyState icon="search" title="Nothing matches that" action={<button className="btn btn-primary" onClick={() => setParams({}, { replace: true })}>Clear search and filters</button>}>
            Try a different word, or remove a filter.
          </EmptyState>
        )}
        {shown.length > 0 && (
          <div className="row row-cols-2 row-cols-md-3 row-cols-lg-4 g-2 g-md-3">
            {shown.map((p) => <div className="col" key={p.id}><ProductCard p={p} /></div>)}
          </div>
        )}
      </div>

      <Sheet
        show={open} onHide={() => setOpen(false)} title="Filters"
        footer={(
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={clearAll} disabled={!activeCount}>Clear</button>
            <button className="btn btn-primary flex-grow-1" onClick={() => setOpen(false)}>Show {shown.length} {shown.length === 1 ? 'product' : 'products'}</button>
          </div>
        )}
      >
        <fieldset className="mb-4">
          <legend className="h6">Condition</legend>
          <div className="d-flex flex-wrap gap-2">
            {CONDITIONS.map((c) => <Chip key={c} active={conditions.includes(c)} onClick={() => toggleCondition(c)}>{c}</Chip>)}
          </div>
        </fieldset>
        <fieldset className="mb-4">
          <legend className="h6">Price</legend>
          <div className="d-flex flex-wrap gap-2">
            {PRICE_BANDS.map(([v, l]) => <Chip key={v} active={band === v} onClick={() => set('price', band === v ? '' : v)}>{l}</Chip>)}
          </div>
        </fieldset>
        <div className="form-check form-switch mb-3 d-flex align-items-center gap-3 ps-0">
          <input id="f-deals" className="form-check-input ms-0 flex-none" type="checkbox" role="switch" checked={deals} onChange={(e) => set('deals', e.target.checked)} />
          <label htmlFor="f-deals" className="form-check-label">Price drops only</label>
        </div>
        <div className="form-check form-switch d-flex align-items-center gap-3 ps-0">
          <input id="f-stock" className="form-check-input ms-0 flex-none" type="checkbox" role="switch" checked={inStock} onChange={(e) => set('instock', e.target.checked)} />
          <label htmlFor="f-stock" className="form-check-label">In stock only</label>
        </div>
      </Sheet>
    </>
  )
}
