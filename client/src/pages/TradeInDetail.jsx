import { useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import useFetch from '../hooks/useFetch'
import { useAuth } from '../context/AuthContext'
import BackLink from '../components/ui/BackLink'
import Facts from '../components/ui/Facts'
import Icon from '../components/ui/Icon'
import Steps from '../components/ui/Steps'
import { EmptyState, ErrorState, Skeleton, StatusPill } from '../components/ui/primitives'
import { TRADEIN_STATUS as T, TRADEIN_LABELS, TRADEIN_CUSTOMER_LABELS, TRADEIN_NEXT_STEP, TRADEIN_TONE, WORKSPACE } from '../constants'
import { gbp, when } from '../format'

const FLOW = [T.SUBMITTED, T.REVIEW, T.OFFER_SENT, T.ACCEPTED, T.PAID, T.COMPLETED]

// One detail page for all roles; the server decides which actions are offered.
export default function TradeInDetail() {
  const { ref } = useParams()
  const { user } = useAuth()
  const { data: t, loading, error, reload } = useFetch(`/tradeins/${ref}`)
  const base = WORKSPACE[user.role].home
  const customer = user.role === 'customer'
  const labels = customer ? TRADEIN_CUSTOMER_LABELS : TRADEIN_LABELS

  // Runs a request, toasts success, refreshes. Failures are toasted by api.js.
  const act = async (request, msg) => {
    try { await request; toast.success(msg); await reload(); return true } catch { return false /* toasted by api.js */ }
  }

  if (loading && !t) return <div className="d-grid gap-3"><Skeleton h="4rem" /><Skeleton h="12rem" /></div>
  if (error) {
    return error.response?.status === 404
      ? <EmptyState icon="search" title="We could not find that trade-in" action={<BackLink to={`${base}/tradeins`}>Back to trade-ins</BackLink>}>Check the reference, or look in your list.</EmptyState>
      : <ErrorState onRetry={reload}>We could not load this trade-in.</ErrorState>
  }

  const name = [t.device.brand, t.device.model].filter(Boolean).join(' ')
  const stopped = [T.DECLINED, T.CANCELLED].includes(t.status)
  const at = FLOW.indexOf(t.status)
  const steps = FLOW.map((s) => ({ label: TRADEIN_CUSTOMER_LABELS[s], hint: TRADEIN_NEXT_STEP[s] }))
  const answering = customer && t.allowed.includes(T.ACCEPTED)

  return (
    <>
      <BackLink to={`${base}/tradeins`}>Trade-ins</BackLink>
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div className="min-w-0"><h1 className="h3 mb-1">{name}</h1><p className="text-secondary mb-0">{t.reference} · {t.branch.area}</p></div>
        <StatusPill tone={TRADEIN_TONE[t.status]}>{labels[t.status]}</StatusPill>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          {customer && (t.finalOffer != null || t.indicativeValue != null) && (
            <section className={`vt-card p-3 mb-3 ${answering ? 'vt-card--attention' : ''}`} aria-label="Your offer">
              {t.finalOffer != null && <><p className="small mb-0">Your offer</p><p className="vt-price mb-1" style={{ fontSize: '2rem' }}>{gbp(t.finalOffer)}</p></>}
              {t.indicativeValue != null && <p className="small mb-1">Guide value: {gbp(t.indicativeValue)} (confirmed after we inspect the device)</p>}
              {answering && <p className="small mb-0 d-flex gap-2"><Icon name="info" size={18} className="flex-none" />You choose whether to accept. There is no pressure.</p>}
            </section>
          )}

          {customer && (
            <section className="vt-card p-3 mb-3" aria-label="Progress">
              <h2 className="h6 mb-3">Progress</h2>
              {stopped
                ? <div className="alert alert-danger mb-0 d-flex gap-2" role="status"><Icon name="x" size={22} className="flex-none" /><span><strong className="d-block">{labels[t.status]}</strong>This request is closed.</span></div>
                : <Steps steps={steps} current={at} finished={t.status === T.COMPLETED} />}
            </section>
          )}

          <section className="vt-card p-3 mb-3" aria-label="Details">
            <h2 className="h6 mb-3">Details</h2>
            <Facts items={[
              !customer && ['Customer', `${t.customer.name} · ${t.customer.email}${t.customer.phone ? ` · ${t.customer.phone}` : ''}`],
              ['Device', [t.device.category, name].filter(Boolean).join(' · ')],
              ['Condition', t.condition],
              ['Branch', t.branch.area],
              ['Sent', when(t.createdAt)],
            ]} />
            {t.details && <><p className="small text-secondary mt-3 mb-1">Notes</p><p className="mb-0">{t.details}</p></>}
            {t.photos.length > 0 && <p className="mt-3 mb-0">{t.photos.map((u, i) => <a key={i} className="me-3" href={u} target="_blank" rel="noreferrer noopener">Photo {i + 1}</a>)}</p>}
          </section>

          <details className="vt-card px-3 mb-3">
            <summary className="vt-sum">History</summary>
            <ul className="list-unstyled small pb-3 mb-0 d-grid gap-2">{t.history.map((h, i) => <li key={i}><strong>{labels[h.status]}</strong> · {h.by} · {when(h.at)}</li>)}</ul>
          </details>
        </div>

        <div className="col-lg-5">
          {customer ? <CustomerPanel t={t} act={act} /> : <StaffPanel key={t.history.length + String(t.finalOffer)} t={t} act={act} />}
        </div>
      </div>
      {answering && <div className="d-md-none" style={{ height: '4.5rem' }} aria-hidden="true" />}
    </>
  )
}

function CustomerPanel({ t, act }) {
  const respond = (action, msg) => act(api.post(`/tradeins/${t.reference}/respond`, { action }), msg)
  if (t.allowed.includes(T.ACCEPTED)) {
    return (
      <div className="vt-bar" role="region" aria-label="Answer your offer">
        <div className="container d-flex gap-2">
          <button className="btn btn-outline-danger px-3" onClick={() => window.confirm('Decline this offer?') && respond('decline', 'Offer declined')}>Decline</button>
          <button className="btn btn-primary flex-grow-1" onClick={() => respond('accept', 'Offer accepted')}>Accept {gbp(t.finalOffer)}</button>
        </div>
      </div>
    )
  }
  if (t.allowed.includes(T.CANCELLED)) {
    return <button className="btn btn-outline-danger w-100" onClick={() => window.confirm('Withdraw this request?') && respond('cancel', 'Request withdrawn')}>Withdraw request</button>
  }
  return null
}

function StaffPanel({ t, act }) {
  const [guide, setGuide] = useState(t.indicativeValue ?? '')
  const [offer, setOffer] = useState(t.finalOffer ?? '')
  const [status, setStatus] = useState('')
  const url = `/tradeins/${t.reference}`
  const num = (v) => (v === '' ? null : Number(v))

  return (
    <>
      <section className="vt-card p-3 mb-3" aria-label="Valuation">
        <h2 className="h6 mb-3">Valuation</h2>
        {t.canEditValues ? (
          <>
            <label className="form-label" htmlFor="guide">Guide value (the customer can see this)</label>
            <div className="input-group mb-3"><span className="input-group-text">£</span><input id="guide" className="form-control" type="number" min="0" step="0.01" value={guide} onChange={(e) => setGuide(e.target.value)} /></div>
            <label className="form-label" htmlFor="offer">Offer (hidden until you send it)</label>
            <div className="input-group mb-3"><span className="input-group-text">£</span><input id="offer" className="form-control" type="number" min="0" step="0.01" value={offer} onChange={(e) => setOffer(e.target.value)} /></div>
            <button className="btn btn-outline-primary" onClick={() => act(api.patch(url, { indicativeValue: num(guide), finalOffer: num(offer) }), 'Valuation saved')}>Save values</button>
          </>
        ) : <p className="mb-0">Guide {t.indicativeValue != null ? gbp(t.indicativeValue) : '-'} · Offer {t.finalOffer != null ? gbp(t.finalOffer) : '-'} <span className="text-secondary">(locked)</span></p>}
      </section>
      <section className="vt-card p-3 mb-3" aria-label="Update status">
        <h2 className="h6 mb-3">Update status</h2>
        {!t.allowed.length ? <p className="text-secondary mb-0">This trade-in is closed.</p> : (
          <div className="input-group">
            <select className="form-select" aria-label="Move to" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Move to…</option>
              {t.allowed.map((s) => <option key={s} value={s}>{TRADEIN_LABELS[s]}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!status} onClick={() => act(api.patch(url, { status }), 'Status updated').then((ok) => ok && setStatus(''))}>Update</button>
          </div>
        )}
        {t.status === T.OFFER_SENT && <p className="small text-secondary mt-2 mb-0">Waiting for the customer to accept or decline.</p>}
      </section>
    </>
  )
}
