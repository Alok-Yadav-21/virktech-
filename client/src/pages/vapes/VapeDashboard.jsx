import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import { ErrorState, Skeleton } from '../../components/ui/primitives'
import { vapeBase } from '../../vapeConstants'
import { gbp } from '../../format'

function Stat({ to, label, value, hint, tone }) {
  return (
    <div className="col-6 col-md-3">
      <Link to={to} className="vt-card h-100 p-3">
        <span className="text-secondary small d-block">{label}</span>
        <span className="d-block lh-1 my-1" style={{ fontSize: '1.75rem', color: tone ? `var(--vt-${tone})` : undefined }}>{value}</span>
        <span className="small text-secondary">{hint}</span>
      </Link>
    </div>
  )
}

// The vape range at a glance. Its revenue and profit are never added to the electronics figures.
export default function VapeDashboard() {
  const { user } = useAuth()
  const base = vapeBase(user.role)
  const { data: s, error, reload } = useFetch('/vapes/dashboard')
  const admin = user.role === 'admin' // profit is admin-only; the server refuses it for staff
  const { data: m } = useFetch(admin ? '/vapes/margins/summary' : null)

  if (error) return <ErrorState onRetry={reload}>We could not load the vape dashboard.</ErrorState>
  return (
    <>
      <h1 className="h3 mb-1">Vapes <span className="vt-pill vt-pill--warn align-middle ms-1">18+</span></h1>
      <p className="text-secondary">{user.role === 'admin' ? 'All branches.' : 'Your branch.'} Separate from electronics: its own stock, orders{admin && ' and profit'}.</p>
      <div className="row g-2 g-md-3 mb-4">
        {s ? (
          <>
            <Stat to={`${base}/orders`} label="Open orders" value={s.openOrders} hint={`${s.unpaidOrders} unpaid`} tone={s.unpaidOrders ? 'warn-ink' : undefined} />
            <Stat to={`${base}/stock`} label="Low stock" value={s.lowStock} hint="product lines at 3 or fewer" tone={s.lowStock ? 'danger' : undefined} />
            {admin && <Stat to={`${base}/orders`} label="Sales, last 30 days" value={gbp(s.revenueLast30Days)} hint="paid vape orders" />}
            {admin && <Stat to={`${base}/profit`} label="Profit, last 30 days" value={m ? gbp(m.profitLast30Days) : '…'} hint="where a cost is recorded" />}
          </>
        ) : Array.from({ length: admin ? 4 : 2 }, (_, i) => <div key={i} className="col-6 col-md-3"><Skeleton h="6rem" /></div>)}
      </div>
      <div className="d-flex flex-wrap gap-2">
        <Link className="btn btn-primary" to={`${base}/deliveries`}>Record a delivery</Link>
        <Link className="btn btn-outline-secondary" to={`${base}/stock`}>Count stock</Link>
        {user.role === 'admin' && <Link className="btn btn-outline-secondary" to={`${base}/products`}>Manage products</Link>}
      </div>
    </>
  )
}
