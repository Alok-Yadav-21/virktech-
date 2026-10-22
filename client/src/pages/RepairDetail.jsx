import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import useFetch from '../hooks/useFetch'
import { useAuth } from '../context/AuthContext'
import BackLink from '../components/ui/BackLink'
import Facts from '../components/ui/Facts'
import { EmptyState, ErrorState, Skeleton, StatusPill } from '../components/ui/primitives'
import Timeline from '../components/repair/Timeline'
import CustomerActions from '../components/repair/CustomerActions'
import Workbench from '../components/repair/Workbench'
import { FULFILMENT_LABELS, REPAIR_TONE, STAGE_TONE, WORKSPACE } from '../constants'
import { gbp, when } from '../format'

// One detail page for all roles; the server decides what each one receives.
export default function RepairDetail() {
  const { ref } = useParams()
  const { user } = useAuth()
  const { data: r, loading, error, reload } = useFetch(`/repairs/${ref}`)
  const base = WORKSPACE[user.role].home
  const customer = user.role === 'customer'

  // Runs a request, toasts success, refreshes. Failures are toasted by api.js.
  const act = async (request, msg) => {
    try { await request; toast.success(msg); await reload(); return true } catch { return false /* toasted by api.js */ }
  }

  if (loading && !r) return <div className="d-grid gap-3"><Skeleton h="5rem" /><Skeleton h="12rem" /></div>
  if (error) {
    return error.response?.status === 404
      ? <EmptyState icon="search" title="We could not find that repair" action={<BackLink to={`${base}/repairs`}>Back to repairs</BackLink>}>Check the reference, or look in your list.</EmptyState>
      : <ErrorState onRetry={reload}>We could not load this repair.</ErrorState>
  }

  const name = [r.device.brand, r.device.model].filter(Boolean).join(' ')
  const needsBar = customer && r.allowed.includes('Repair in progress')

  return (
    <>
      <BackLink to={`${base}/repairs`}>Repairs</BackLink>
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div className="min-w-0">
          <h1 className="h3 mb-1">{name}</h1>
          <p className="text-secondary mb-0">{r.reference} · {r.branch.area}</p>
        </div>
        {customer
          ? <StatusPill tone={STAGE_TONE[r.stage.key]}>{r.stage.label}</StatusPill>
          : <StatusPill tone={REPAIR_TONE[r.status]}>{r.status}</StatusPill>}
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          {customer && <CustomerActions repair={r} act={act} />}
          {customer && <section className="vt-card p-3 mb-3" aria-label="Progress"><h2 className="h6 mb-3">Progress</h2><Timeline repair={r} /></section>}

          <section className="vt-card p-3 mb-3" aria-label="Details">
            <h2 className="h6 mb-3">Details</h2>
            <Facts items={[
              !customer && ['Customer', `${r.customer.name} · ${r.customer.email}${r.customer.phone ? ` · ${r.customer.phone}` : ''}`],
              ['Device', [r.device.category, name].filter(Boolean).join(' · ')],
              ['Branch', r.branch.area],
              ['Device reaches us', FULFILMENT_LABELS[r.fulfilment]],
              !customer && ['Technician', r.technician?.name || '-'],
              ['Booked', when(r.createdAt)],
              !customer && r.quote != null && ['Payment', r.paymentStatus === 'paid' ? `Paid ${gbp(r.amountDue)}` : r.paymentStatus === 'refunded' ? 'Refunded' : `Due ${gbp(r.amountDue)}`],
            ]} />
            <p className="small text-secondary mt-3 mb-1">What is wrong</p>
            <p className="mb-0">{r.problem}</p>
          </section>

          {customer && r.notes.length > 0 && (
            <section className="vt-card p-3 mb-3" aria-label="Updates from the branch">
              <h2 className="h6 mb-3">Updates from the branch</h2>
              {r.notes.map((n, i) => <p key={i} className="mb-2">{n.text}<span className="d-block small text-secondary">{when(n.at)}</span></p>)}
            </section>
          )}

          <details className="vt-card px-3 mb-3">
            <summary className="vt-sum">History</summary>
            <ul className="list-unstyled small pb-3 mb-0 d-grid gap-2">
              {r.history.map((h, i) => <li key={i}><strong>{h.status}</strong> · {h.by} · {when(h.at)}{h.reason && <span className="d-block text-secondary">{h.reason}</span>}</li>)}
            </ul>
          </details>
        </div>
        {!customer && <div className="col-lg-5"><Workbench key={r.updatedAt} repair={r} act={act} isAdmin={user.role === 'admin'} /></div>}
      </div>
      {needsBar && <div className="d-md-none" style={{ height: '4.5rem' }} aria-hidden="true" />}
    </>
  )
}
