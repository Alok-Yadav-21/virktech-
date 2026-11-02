import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import useFetch from '../hooks/useFetch'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/primitives'
import { gbp } from '../format'

const m = (n) => `${n < 0 ? '-' : ''}${gbp(Math.abs(n)) || '£0'}`
const tone = (n) => (n < 0 ? 'text-danger' : '')
const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

// A block of figures for one range. Electronics, vapes and repairs are never added into each other.
function Block({ title, rows }) {
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <div className="vt-card p-3 h-100">
        <h2 className="h6">{title}</h2>
        <dl className="mb-0">
          {rows.map(([k, v, bold]) => (
            <div key={k} className="d-flex justify-content-between gap-3 py-1 border-bottom">
              <dt className="fw-normal text-secondary">{k}</dt>
              <dd className={`mb-0 ${bold ? 'fw-bold' : ''} ${bold ? tone(v) : ''}`}>{typeof v === 'number' ? m(v) : v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function Blocks({ t }) {
  return (
    <div className="row g-2 g-md-3 mb-4">
      <Block title="Electronics" rows={[['Orders', t.electronics.orders], ['Revenue', t.electronics.revenue], ['Cost of items sold', t.electronics.cost], ['Profit', t.electronics.profit, true]]} />
      <Block title="Vapes" rows={[['Orders', t.vapes.orders], ['Revenue', t.vapes.revenue], ['Cost of items sold', t.vapes.cost], ['Profit', t.vapes.profit, true]]} />
      <Block title="Repairs" rows={[['Paid jobs', t.repairs.jobs], ['Takings', t.repairs.takings], ['Parts cost', t.repairs.parts], ['Profit', t.repairs.profit, true]]} />
      <Block title="Everything together" rows={[['Revenue', t.everything.revenue], ['Profit', t.everything.profit, true]]} />
    </div>
  )
}

function Sold({ title, list }) {
  if (!list.length) return null
  return (
    <div className="mb-4">
      <h2 className="h6">{title}: what sold</h2>
      <div className="vt-card table-responsive">
        <table className="table align-middle mb-0">
          <thead><tr><th>Product</th><th className="text-end">Sold</th><th className="text-end">Revenue</th><th className="text-end">Profit</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.productId}>
                <td>{p.name}</td><td className="text-end">{p.units}</td><td className="text-end">{m(p.revenue)}</td>
                <td className={`text-end ${p.profit == null ? 'text-secondary' : tone(p.profit)}`}>{p.profit == null ? 'cost unknown' : m(p.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Admin report: every branch together and branch by branch, all the way to date (or between two dates). Print it to save a PDF.
export default function Reports() {
  const { branchId } = useParams()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const qs = new URLSearchParams({ ...(branchId && { branchId }), ...(from && { from }), ...(to && { to }) }).toString()
  const { data, loading, error, reload } = useFetch(`/reports${qs ? `?${qs}` : ''}`)

  const uncosted = data ? data.total.electronics.uncosted + data.total.vapes.uncosted : 0
  const range = from || to ? `${from ? day(from) : 'the start'} to ${to ? day(to) : 'today'}` : 'all time, up to today'

  return (
    <div className="print-report">
      <div className="d-flex flex-wrap align-items-end gap-2 mb-1">
        <h1 className="h3 me-auto mb-0">{data?.branch ? `${data.branch.area} branch report` : 'Profit and revenue report'}</h1>
        <button className="btn btn-primary no-print" onClick={() => window.print()} disabled={!data}>Download PDF</button>
      </div>
      <p className="text-secondary">
        {data?.branch ? data.branch.area : 'All branches'} · {range} · made {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        {data?.branch && <> · <Link to="/admin/reports" className="no-print">All branches</Link></>}
      </p>

      <div className="row g-2 mb-3 no-print">
        <div className="col-6 col-md-3"><label className="form-label small" htmlFor="from">From</label><input id="from" type="date" className="form-control" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="col-6 col-md-3"><label className="form-label small" htmlFor="to">To</label><input id="to" type="date" className="form-control" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></div>
        {(from || to) && <div className="col-12 col-md-3 d-flex align-items-end"><button className="btn btn-outline-secondary" onClick={() => { setFrom(''); setTo('') }}>Show everything</button></div>}
      </div>

      {error && <ErrorState onRetry={reload}>We could not load the report.</ErrorState>}
      {loading && !data && <Skeleton h="10rem" />}
      {data && (
        <>
          {uncosted > 0 && (
            <div className="alert alert-danger" role="alert">
              {m(uncosted)} was sold on products with no bought-for price, so no profit is counted for it. <Link to="/admin/profit" className="no-print">Add the prices</Link>
            </div>
          )}

          <h2 className="h6 text-secondary text-uppercase">{data.branch ? data.branch.area : 'All branches combined'}</h2>
          <Blocks t={data.total} />

          {!data.branch && (
            <>
              <h2 className="h6 text-secondary text-uppercase">Branch by branch</h2>
              {!data.branches.length ? <EmptyState icon="chart" title="No branches yet">Add a branch first.</EmptyState> : (
                <div className="vt-card table-responsive mb-4">
                  <table className="table align-middle mb-0">
                    <thead>
                      <tr><th>Branch</th><th className="text-end">Electronics revenue</th><th className="text-end">Electronics profit</th><th className="text-end">Vape revenue</th><th className="text-end">Vape profit</th>
                        <th className="text-end">Repair takings</th><th className="text-end">Repair profit</th><th className="text-end">Everything profit</th></tr>
                    </thead>
                    <tbody>
                      {data.branches.map((b) => (
                        <tr key={b.id}>
                          <td><Link to={`/admin/reports/${b.id}`}>{b.area}</Link></td>
                          <td className="text-end">{m(b.electronics.revenue)}</td><td className={`text-end ${tone(b.electronics.profit)}`}>{m(b.electronics.profit)}</td>
                          <td className="text-end">{m(b.vapes.revenue)}</td><td className={`text-end ${tone(b.vapes.profit)}`}>{m(b.vapes.profit)}</td>
                          <td className="text-end">{m(b.repairs.takings)}</td><td className={`text-end ${tone(b.repairs.profit)}`}>{m(b.repairs.profit)}</td>
                          <td className={`text-end fw-bold ${tone(b.everything.profit)}`}>{m(b.everything.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {data.sold && <><Sold title="Electronics" list={data.sold.electronics} /><Sold title="Vapes" list={data.sold.vapes} /></>}

          <p className="small text-secondary">
            Revenue is what customers paid on paid orders that were not cancelled or refunded, till sales included. Profit is the selling price minus the bought-for price of each item sold, before any loyalty discount.
            Repairs are paid jobs minus the parts logged on them. Electronics, vapes and repairs are kept apart; “Everything together” just adds them up.
          </p>
        </>
      )}
    </div>
  )
}
