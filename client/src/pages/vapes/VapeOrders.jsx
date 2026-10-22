import { useState } from 'react'
import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import useDebounce from '../../hooks/useDebounce'
import ListFilters from '../../components/ListFilters'
import RowCard from '../../components/ui/RowCard'
import { EmptyState, ErrorState, Skeleton, StatusPill } from '../../components/ui/primitives'
import { useAuth } from '../../context/AuthContext'
import { ORDER_TONE } from '../../constants'
import { VAPE_STATUSES, VAPE_CUSTOMER_STATUSES, vapeOrdersBase } from '../../vapeConstants'
import { gbp, plural, when } from '../../format'

// Vape orders for all three roles: the server already scoped the rows.
export default function VapeOrders() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const search = useDebounce(q.trim())
  const params = new URLSearchParams({ limit: '100' })
  if (search) params.set('q', search)
  if (status) params.set('status', status)
  const { data: rows, total, loading, error, reload } = useFetch(`/vapes/orders?${params}`)
  const base = vapeOrdersBase(user.role)
  const customer = user.role === 'customer'
  const labels = customer ? VAPE_CUSTOMER_STATUSES : VAPE_STATUSES
  const pill = (o) => <StatusPill tone={ORDER_TONE[o.status]}>{labels[o.status]}</StatusPill>
  const count = (o) => plural(o.items.reduce((n, i) => n + i.qty, 0), 'item')

  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-3">
        <h1 className="h3 mb-0">{customer ? 'My vape orders' : 'Vape orders'}</h1>
        {customer && <Link className="btn btn-primary btn-sm" to="/vapes">Shop vapes</Link>}
      </div>
      <ListFilters q={q} onQ={setQ} status={status} onStatus={setStatus} shown={rows?.length ?? 0} total={total}
        statuses={customer ? null : Object.entries(VAPE_STATUSES)} placeholder={customer ? 'Search your orders' : 'Search reference or customer'} />
      {error && <ErrorState onRetry={reload}>We could not load orders.</ErrorState>}
      {loading && !rows && <div className="d-grid gap-2"><Skeleton h="5rem" /><Skeleton h="5rem" /></div>}
      {rows && !rows.length && (search || status
        ? <EmptyState icon="search" title="No orders match">Try a different search or status.</EmptyState>
        : <EmptyState icon="receipt" title="No vape orders yet" action={customer && <Link className="btn btn-primary" to="/vapes">Browse vapes</Link>}>{customer ? 'Your vape orders will appear here.' : 'New vape orders will appear here.'}</EmptyState>)}

      {!!rows?.length && (
        <div className={loading ? 'opacity-50' : ''}>
          <div className={`d-grid gap-2 ${customer ? '' : 'd-md-none'}`}>
            {rows.map((o) => (
              <RowCard key={o.reference} to={`${base}/${o.reference}`} icon="receipt" title={o.reference}
                subtitle={`${customer ? '' : `${o.customer.name} · `}${count(o)} · ${gbp(o.total)}`} meta={`Collect from ${o.branch.area} · ${when(o.createdAt)}`} right={pill(o)} />
            ))}
          </div>
          {!customer && (
            <div className="vt-card d-none d-md-block table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead><tr><th>Reference</th><th>Customer</th>{user.role === 'admin' && <th>Branch</th>}<th>Total</th><th>Payment</th><th>Status</th><th>Placed</th></tr></thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.reference}>
                      <td><Link to={`${base}/${o.reference}`}>{o.reference}</Link></td>
                      <td>{o.customer.name}</td>
                      {user.role === 'admin' && <td>{o.branch.area}</td>}
                      <td>{gbp(o.total)}</td>
                      <td className="text-capitalize">{o.paymentStatus}</td>
                      <td>{pill(o)}</td>
                      <td className="text-nowrap">{when(o.createdAt)}</td>
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
