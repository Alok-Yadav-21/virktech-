import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import useFetch from '../../hooks/useFetch'
import { useVapeCart } from '../../context/VapeCartContext'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import AgeGate from '../../components/vapes/AgeGate'
import VapeCard, { VapeImage } from '../../components/vapes/VapeCard'
import { EmptyState, ErrorState, Price, SectionHead, Skeleton } from '../../components/ui/primitives'
import { nicotineLabel } from '../../vapeConstants'
import { gbp } from '../../format'

export default function VapeProduct() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, add } = useVapeCart()
  const { branch, openPicker } = useBranch()
  const { data: p, loading, error, reload } = useFetch(`/vapes/products/${id}`)
  const { data: rows } = useFetch(`/vapes/products/${id}/availability`)
  const { data: all } = useFetch('/vapes/products')

  if (loading && !p) return <div className="d-grid gap-3"><AgeGate /><Skeleton h="16rem" /><Skeleton h="2rem" w="70%" /></div>
  if (error) {
    return error.response?.status === 404
      ? <EmptyState icon="search" title="We could not find that product" action={<Link className="btn btn-primary" to="/vapes">Back to vapes</Link>}>It may have been removed.</EmptyState>
      : <ErrorState onRetry={reload}>We could not load this product.</ErrorState>
  }

  const out = p.stockTotal < 1
  const here = branch && rows?.find((r) => r.branchId === branch.id)
  const related = (all || []).filter((x) => x.brand === p.brand && x.id !== p.id).slice(0, 8)
  const inBasket = items.some((i) => i.productId === p.id)
  const addToBasket = () => { add(p); toast.success('Added to vape basket') }
  const buyNow = () => { if (!inBasket) add(p); navigate('/vapes/basket') }

  return (
    <>
      <AgeGate />
      <nav aria-label="Breadcrumb" className="small mb-2">
        <Link to="/vapes">Vapes</Link> <span className="text-secondary">/</span> <Link to={`/vapes?brand=${encodeURIComponent(p.brand)}`}>{p.brand}</Link>
      </nav>
      <div className="row g-4">
        <div className="col-md-6"><div className="vt-bleed"><div className="vt-gallery"><VapeImage p={p} width="1200" height="900" /></div></div></div>
        <div className="col-md-6">
          <p className="text-secondary mb-1">{p.brand} · {p.kind} <span className="vt-pill vt-pill--warn ms-1">18+</span></p>
          <h1 className="h2 mb-2">{p.name}</h1>
          <div className="mb-3"><Price price={p.price} was={p.wasPrice} size="1.9rem" /></div>

          <dl className="row small mb-3 gy-1">
            {[p.flavour && ['Flavour', p.flavour], p.flavourGroup && ['Flavour type', p.flavourGroup], ['Nicotine', nicotineLabel(p.nicotineMg)], p.sizeMl && ['Size', `${p.sizeMl}ml`]].filter(Boolean).map(([k, v]) => (
              <div key={k} className="col-12 d-flex justify-content-between gap-3"><dt className="fw-normal text-secondary">{k}</dt><dd className="mb-0">{v}</dd></div>
            ))}
          </dl>

          <div className="vt-card p-3 mb-3">
            {!rows ? <Skeleton h="1.25rem" w="60%" /> : (
              <>
                <p className={`d-flex align-items-center gap-2 mb-1 ${out ? 'text-danger' : here?.stock === 0 ? 'text-danger' : 'text-success'}`}>
                  <Icon name={out || here?.stock === 0 ? 'x' : 'check'} size={20} />
                  {out ? 'Out of stock at every branch' : here ? (here.stock > 0 ? `In stock at ${here.area}` : `Out of stock at ${here.area}`) : `In stock at ${rows.filter((r) => r.stock > 0).length} of ${rows.length} branches`}
                </p>
                <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={openPicker}><Icon name="pin" size={16} />{branch ? 'Change branch' : 'Check my branch'}</button>
              </>
            )}
          </div>

          {p.description && <p className="mb-3">{p.description}</p>}
          <ul className="list-unstyled d-grid gap-2 mb-4 small">
            <li className="d-flex gap-2"><Icon name="shield" size={20} className="flex-none text-success" />Collect in store and pay at the counter. Bring photo ID: you must be 18 or over.</li>
            <li className="d-flex gap-2"><Icon name="info" size={20} className="flex-none text-secondary" />Contains nicotine, which is addictive. For adult smokers; not for under-18s.</li>
          </ul>

          {rows && (
            <details className="mb-4">
              <summary className="vt-sum">Stock at every branch</summary>
              <ul className="list-unstyled small mb-0">
                {rows.map((r) => <li key={r.branchId} className="d-flex justify-content-between py-1 border-bottom"><span>{r.area}</span><span className={r.stock > 0 ? '' : 'text-secondary'}>{r.stock > 3 ? 'In stock' : r.stock > 0 ? `Only ${r.stock} left` : 'Out of stock'}</span></li>)}
              </ul>
            </details>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-4" aria-labelledby="more-title">
          <SectionHead title={<span id="more-title">More from {p.brand}</span>} to={`/vapes?brand=${encodeURIComponent(p.brand)}`} />
          <div className="vt-rail">{related.map((r) => <div key={r.id} className="vt-productwrap"><VapeCard p={r} /></div>)}</div>
        </section>
      )}

      <div className="d-md-none" style={{ height: '4.5rem' }} aria-hidden="true" />
      <div className="vt-bar" role="region" aria-label="Buy">
        <div className="container d-flex align-items-center gap-2">
          <div className="me-auto lh-sm d-md-none"><span className="vt-price d-block" style={{ fontSize: '1.2rem' }}>{gbp(p.price)}</span></div>
          <button className="btn btn-outline-primary px-3" disabled={out} onClick={addToBasket}>{out ? 'Out of stock' : inBasket ? 'Add another' : 'Add to basket'}</button>
          <button className="btn btn-primary px-3" disabled={out} onClick={buyNow}>Buy now</button>
        </div>
      </div>
    </>
  )
}
