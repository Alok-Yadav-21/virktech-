import { useState } from 'react'
import { Link } from 'react-router-dom'
import useFetch from '../hooks/useFetch'
import useDebounce from '../hooks/useDebounce'
import ListFilters from '../components/ListFilters'
import RowCard from '../components/ui/RowCard'
import { EmptyState, ErrorState, Skeleton, StatusPill } from '../components/ui/primitives'
import { useAuth } from '../context/AuthContext'
import { REPAIR_STATUSES, REPAIR_TONE, STAGE_TONE, WORKSPACE } from '../constants'
import { when } from '../format'

const deviceName = (r) => [r.device.brand, r.device.model].filter(Boolean).join(' ')

// Shared by all three roles: the server already scoped the rows. Customers (and any phone) get tappable rows;
// staff and admin get a table on wider screens.
export default function RepairList() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const search = useDebounce(q.trim())
  const params = new URLSearchParams({ limit: '100' })
  if (search) params.set('q', search)
  if (status) params.set('status', status)
  const { data: rows, total, loading, error, reload } = useFetch(`/repairs?${params}`)
  const base = WORKSPACE[user.role].home
  const customer = user.role === 'customer'
  const pill = (r) => (customer
    ? <StatusPill tone={STAGE_TONE[r.stage.key]}>{r.stage.label}</StatusPill>
    : <StatusPill tone={REPAIR_TONE[r.status]}>{r.status}</StatusPill>)

  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h1 className="h3 mb-0">{customer ? 'My repairs' : user.role === 'admin' ? 'All repairs' : 'Branch repairs'}</h1>
        {customer && <Link className="btn btn-primary btn-sm" to="/app/book">Book a repair</Link>}
      </div>
      <ListFilters q={q} onQ={setQ} status={status} onStatus={setStatus} shown={rows?.length ?? 0} total={total}
        statuses={customer ? null : REPAIR_STATUSES.map((s) => [s, s])} placeholder={customer ? 'Search your repairs' : 'Search reference, customer or device'} />
      {error && <ErrorState onRetry={reload}>We could not load repairs.</ErrorState>}
      {loading && !rows && <div className="d-grid gap-2"><Skeleton h="5rem" /><Skeleton h="5rem" /><Skeleton h="5rem" /></div>}
      {rows && !rows.length && (search || status
        ? <EmptyState icon="search" title="No repairs match">Try a different search or status.</EmptyState>
        : <EmptyState icon="wrench" title="No repairs yet" action={customer && <Link className="btn btn-primary" to="/app/book">Book a repair</Link>}>{customer ? 'When you book one, you can follow every step here.' : 'New bookings will appear here.'}</EmptyState>)}

      {!!rows?.length && (
        <div className={loading ? 'opacity-50' : ''}>
          <div className={`d-grid gap-2 ${customer ? '' : 'd-md-none'}`}>
            {rows.map((r) => (
              <RowCard key={r.reference} to={`${base}/repairs/${r.reference}`} icon="wrench" title={deviceName(r)}
                subtitle={`${r.reference}${customer ? '' : ` · ${r.customer.name}`}`} meta={`${r.branch.area} · ${when(r.createdAt)}`} right={pill(r)} />
            ))}
          </div>
          {!customer && (
            <div className="vt-card d-none d-md-block table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead><tr><th>Reference</th><th>Customer</th><th>Device</th>{user.role === 'admin' && <th>Branch</th>}{user.role === 'admin' && <th>Technician</th>}<th>Status</th><th>Booked</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.reference}>
                      <td><Link to={`${base}/repairs/${r.reference}`} className="fw-semibold">{r.reference}</Link></td>
                      <td>{r.customer.name}</td>
                      <td>{deviceName(r)}</td>
                      {user.role === 'admin' && <td>{r.branch.area}</td>}
                      {user.role === 'admin' && <td>{r.technician?.name || <span className="text-secondary">-</span>}</td>}
                      <td>{pill(r)}{r.paymentStatus === 'paid' && <span className="vt-pill vt-pill--success ms-1">Paid</span>}</td>
                      <td className="text-nowrap">{when(r.createdAt)}</td>
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
