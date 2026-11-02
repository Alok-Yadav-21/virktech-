import { Link } from 'react-router-dom'
import useFetch from '../hooks/useFetch'
import { useAuth } from '../context/AuthContext'
import { ErrorState, Skeleton } from '../components/ui/primitives'
import { ROLES, WORKSPACE } from '../constants'
import { gbp } from '../format'

function Stat({ to, label, value, hint, tone }) {
  return (
    <div className="col-6 col-md-4 col-xl">
      <Link to={to} className="vt-card h-100 p-3">
        <span className="text-secondary small d-block">{label}</span>
        <span className="d-block fw-bold lh-1 my-1" style={{ fontSize: '1.75rem', color: tone ? `var(--vt-${tone})` : undefined }}>{value}</span>
        {hint && <span className="small text-secondary">{hint}</span>}
      </Link>
    </div>
  )
}

// `link(row)` turns a row's name into a link (used for the branch names).
function Bars({ rows, label, valueKey, secondKey, max, link }) {
  return (
    <table className="table table-sm align-middle mb-0">
      <tbody>
        {rows.map((d) => (
          <tr key={label(d)}>
            <td className="text-nowrap">{link ? <Link to={link(d)}>{label(d)}</Link> : label(d)}</td>
            <td style={{ width: '38%' }}>
              <div className="progress mb-1" role="progressbar" aria-label={`Orders, ${label(d)}`}><div className="progress-bar" style={{ width: `${(d[valueKey] / max) * 100}%` }} /></div>
              <div className="progress" role="progressbar" aria-label={`Repairs, ${label(d)}`}><div className="progress-bar bg-warning" style={{ width: `${(d[secondKey] / max) * 100}%` }} /></div>
            </td>
            <td className="text-end text-nowrap small">{gbp(d[valueKey])}<div className="text-secondary">{gbp(d[secondKey])}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Staff (their branch) and admin (everything). Order revenue and repair takings stay separate figures, never added together.
export default function StaffDashboard() {
  const { user } = useAuth()
  const { data: s, loading, error, reload } = useFetch('/dashboard/stats')
  const base = WORKSPACE[user.role].home

  if (error) return <ErrorState onRetry={reload}>We could not load the dashboard.</ErrorState>
  if (loading && !s) return <div className="row g-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="col-6 col-md-4 col-xl"><Skeleton h="6rem" /></div>)}</div>

  // Money figures exist for admin only: the server does not send them to staff.
  const admin = user.role === ROLES.ADMIN
  const total14 = admin ? s.revenueByDay.reduce((n, d) => n + d.revenue, 0) : 0
  const takings14 = admin ? s.revenueByDay.reduce((n, d) => n + d.repairTakings, 0) : 0
  const maxDay = admin ? Math.max(1, ...s.revenueByDay.map((d) => Math.max(d.revenue, d.repairTakings))) : 1
  const maxBranch = admin ? Math.max(1, ...s.revenueByBranch.map((b) => Math.max(b.revenue, b.repairTakings))) : 1
  const stockLink = user.role === ROLES.ADMIN ? '/admin/stock' : '/staff/stock'

  return (
    <>
      <h1 className="h3 mb-3">{user.role === ROLES.ADMIN ? 'All branches' : 'Your branch'}</h1>
      <div className="row g-2 g-md-3 mb-4">
        <Stat to={`${base}/repairs`} label="Open repairs" value={s.repairs.open} hint={`${s.repairs.total} in total`} />
        <Stat to={`${base}/repairs`} label="Awaiting payment" value={s.repairsAwaitingPayment} hint="repairs ready, not yet paid" tone={s.repairsAwaitingPayment ? 'warn-ink' : undefined} />
        <Stat to={`${base}/orders`} label="Open orders" value={s.orders.open} hint={`${s.unpaidOrders} unpaid`} tone={s.unpaidOrders ? 'warn-ink' : undefined} />
        <Stat to={`${base}/tradeins`} label="Open trade-ins" value={s.tradeIns.open} hint={`${s.tradeIns.total} in total`} />
        <Stat to={stockLink} label="Low stock" value={s.lowStock} hint="product lines at 3 or fewer" tone={s.lowStock ? 'danger' : undefined} />
      </div>

      <div className="row g-3">
        {admin && <div className="col-xl-7">
          <div className="vt-card p-3 h-100">
            <h2 className="h6 mb-1">Last 14 days <Link to="/admin/reports" className="small fw-normal ms-2">Revenue and profit report</Link></h2>
            <p className="mb-1">Order revenue <strong>{gbp(total14)}</strong> · Repair takings <strong>{gbp(takings14)}</strong></p>
            <p className="small text-secondary">Order revenue is paid orders only (cancelled and refunded are not counted). Repair takings are paid repairs, shown separately. Green bar: orders. Amber bar: repairs.</p>
            <div className="table-responsive">
              <Bars rows={[...s.revenueByDay].reverse()} label={(d) => new Date(d.day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} valueKey="revenue" secondKey="repairTakings" max={maxDay} />
            </div>
          </div>
        </div>}
        <div className={admin ? 'col-xl-5' : 'col-12'}>
          {admin && <div className="vt-card p-3 mb-3">
            <h2 className="h6">By branch, last 30 days <small className="text-secondary fw-normal">(orders / repairs)</small></h2>
            <p className="small text-secondary mb-1">Click a branch for its revenue and profit report.</p>
            <div className="table-responsive"><Bars rows={s.revenueByBranch} label={(b) => b.branch} valueKey="revenue" secondKey="repairTakings" max={maxBranch} link={(b) => `/admin/reports/${b.id}`} /></div>
          </div>}
          <div className="vt-card p-3">
            <h2 className="h6">Open repairs by status</h2>
            {!s.repairsByStatus.length ? <p className="text-secondary mb-0">No open repairs.</p> : (
              <ul className="list-unstyled mb-0">
                {s.repairsByStatus.map((r) => <li key={r.status} className="d-flex justify-content-between py-1"><span>{r.status}</span><span className="vt-pill">{r.count}</span></li>)}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
