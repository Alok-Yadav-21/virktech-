import { useState } from 'react'
import { Link } from 'react-router-dom'
import useFetch from '../hooks/useFetch'
import useDebounce from '../hooks/useDebounce'
import ListFilters from '../components/ListFilters'
import RowCard from '../components/ui/RowCard'
import { EmptyState, ErrorState, Skeleton, StatusPill } from '../components/ui/primitives'
import { useAuth } from '../context/AuthContext'
import { TRADEIN_CUSTOMER_LABELS, TRADEIN_LABELS, TRADEIN_TONE, WORKSPACE } from '../constants'
import { gbp, when } from '../format'

const deviceName = (t) => [t.device.brand, t.device.model].filter(Boolean).join(' ')

// Shared by all three roles: the server already scoped the rows.
export default function TradeInList() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const search = useDebounce(q.trim())
  const params = new URLSearchParams({ limit: '100' })
  if (search) params.set('q', search)
  if (status) params.set('status', status)
  const { data: rows, total, loading, error, reload } = useFetch(`/tradeins?${params}`)
  const base = WORKSPACE[user.role].home
  const customer = user.role === 'customer'
  const labels = customer ? TRADEIN_CUSTOMER_LABELS : TRADEIN_LABELS
  const pill = (t) => <StatusPill tone={TRADEIN_TONE[t.status]}>{labels[t.status]}</StatusPill>

  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h1 className="h3 mb-0">{customer ? 'My trade-ins' : user.role === 'admin' ? 'All trade-ins' : 'Branch trade-ins'}</h1>
        {customer && <Link className="btn btn-primary btn-sm" to="/app/sell">Sell a device</Link>}
      </div>
      <ListFilters q={q} onQ={setQ} status={status} onStatus={setStatus} shown={rows?.length ?? 0} total={total}
        statuses={customer ? null : Object.entries(TRADEIN_LABELS)} placeholder={customer ? 'Search your trade-ins' : 'Search reference, customer or device'} />
      {error && <ErrorState onRetry={reload}>We could not load trade-ins.</ErrorState>}
      {loading && !rows && <div className="d-grid gap-2"><Skeleton h="5rem" /><Skeleton h="5rem" /></div>}
      {rows && !rows.length && (search || status
        ? <EmptyState icon="search" title="No trade-ins match">Try a different search or status.</EmptyState>
        : <EmptyState icon="swap" title="No trade-ins yet" action={customer && <Link className="btn btn-primary" to="/app/sell">Get an offer</Link>}>{customer ? 'Tell us about a device you no longer need and we will make you an offer.' : 'New requests will appear here.'}</EmptyState>)}

      {!!rows?.length && (
        <div className={loading ? 'opacity-50' : ''}>
          <div className={`d-grid gap-2 ${customer ? '' : 'd-md-none'}`}>
            {rows.map((t) => (
              <RowCard key={t.reference} to={`${base}/tradeins/${t.reference}`} icon="swap" title={deviceName(t)}
                subtitle={`${t.reference}${customer ? '' : ` · ${t.customer.name}`}`} meta={`${t.finalOffer != null ? `Offer ${gbp(t.finalOffer)} · ` : ''}${when(t.createdAt)}`} right={pill(t)} />
            ))}
          </div>
          {!customer && (
            <div className="vt-card d-none d-md-block table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead><tr><th>Reference</th><th>Customer</th><th>Device</th>{user.role === 'admin' && <th>Branch</th>}<th>Offer</th><th>Status</th><th>Sent</th></tr></thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.reference}>
                      <td><Link to={`${base}/tradeins/${t.reference}`} className="fw-semibold">{t.reference}</Link></td>
                      <td>{t.customer.name}</td>
                      <td>{deviceName(t)}</td>
                      {user.role === 'admin' && <td>{t.branch.area}</td>}
                      <td>{t.finalOffer != null ? gbp(t.finalOffer) : <span className="text-secondary">-</span>}</td>
                      <td>{pill(t)}</td>
                      <td className="text-nowrap">{when(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
