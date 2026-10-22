import { Suspense, lazy, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'

const BranchMap = lazy(() => import('../../components/BranchMap'))

export default function Branches() {
  const { data, loading, error, reload } = useFetch('/branches')
  const { branch: mine, setBranchId } = useBranch()
  const [params, setParams] = useSearchParams()
  const [postcode, setPostcode] = useState(params.get('postcode') || '')
  const [found, setFound] = useState(null) // { origin, branches } from /nearest
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null)

  const search = async (term) => {
    setBusy(true)
    try { setFound((await api.get('/branches/nearest', { params: { postcode: term } })).data) } catch { /* api.js toasted the reason */ } finally { setBusy(false) }
  }
  // A postcode in the address (from the home page box) searches straight away.
  useEffect(() => { const t = params.get('postcode'); if (t) search(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => { e.preventDefault(); setParams(postcode ? { postcode } : {}, { replace: true }); search(postcode) }
  const clear = () => { setFound(null); setPostcode(''); setParams({}, { replace: true }) }

  if (loading && !data) return <div className="d-grid gap-3"><Skeleton h="3rem" /><Skeleton h="8rem" /><Skeleton h="8rem" /></div>
  if (error) return <ErrorState onRetry={reload}>We could not load the branches.</ErrorState>
  if (!data.length) return <EmptyState icon="pin" title="No branches to show yet">Please check back soon.</EmptyState>

  const list = found?.branches || data

  return (
    <>
      <h1 className="h3 mb-3">Find a branch</h1>
      <form className="input-group mb-3" onSubmit={submit}>
        <input className="form-control" aria-label="Your postcode" placeholder="Your postcode, e.g. SE18 6EX" autoComplete="postal-code" enterKeyHint="search" required value={postcode} onChange={(e) => setPostcode(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Finding…' : 'Find nearest'}</button>
      </form>
      {found && <button type="button" className="btn btn-link p-0 mb-3" onClick={clear}>Show all branches</button>}

      <div className="row g-3">
        <div className="col-lg-5 order-2 order-lg-1">
          <ul className="list-unstyled d-grid gap-2 mb-0 vt-scroll-lg">
            {list.map((b, i) => (
              <li key={b.id} className="vt-card p-3" style={selected === b.id ? { borderColor: 'var(--vt-green-600)', boxShadow: '0 0 0 1px var(--vt-green-600) inset' } : undefined}>
                <div className="d-flex align-items-start justify-content-between gap-2">
                  <div>
                    <h2 className="h6 mb-0">{b.area} {found && i === 0 && <span className="vt-pill vt-pill--success ms-1">Nearest</span>}</h2>
                    <p className="text-secondary small mb-1">{b.name}</p>
                  </div>
                  {b.distanceMiles != null && <span className="fw-semibold text-nowrap small">{b.distanceMiles.toFixed(1)} mi</span>}
                </div>
                <p className="mb-2 small">{b.address}, {b.postcode}</p>
                <div className="d-flex flex-wrap gap-2">
                  {b.lat != null && <a className="btn btn-sm btn-outline-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`} target="_blank" rel="noreferrer noopener"><Icon name="arrow" size={16} />Directions</a>}
                  {b.phone && <a className="btn btn-sm btn-outline-secondary" href={`tel:${b.phone.replace(/\s/g, '')}`}><Icon name="phone" size={16} />Call</a>}
                  {mine?.id === b.id
                    ? <span className="vt-pill vt-pill--brand align-self-center"><Icon name="check" size={14} />Your branch</span>
                    : <button className="btn btn-sm btn-outline-primary" onClick={() => { setBranchId(b.id); toast.success(`Collecting from ${b.area}`) }}>Use this branch</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="col-lg-7 order-1 order-lg-2">
          <div className="rounded-4 overflow-hidden border position-sticky" style={{ height: 'min(70vw, 28rem)', minHeight: 280, top: '5rem' }}>
            <Suspense fallback={<Skeleton h="100%" style={{ borderRadius: 0 }} />}>
              <BranchMap branches={list} origin={found?.origin} selectedId={selected} onSelect={setSelected} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  )
}
