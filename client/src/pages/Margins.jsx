import { useState } from 'react'
import { Link } from 'react-router-dom'
import useFetch from '../hooks/useFetch'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
import ListFilters from '../components/ListFilters'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/primitives'
import { WORKSPACE } from '../constants'
import { gbp } from '../format'

const pct = (n) => (n == null ? '–' : `${n}%`)
const money = (n) => (n == null ? '–' : `${n < 0 ? '-' : ''}${gbp(Math.abs(n))}`)
const tone = (n) => (n != null && n < 0 ? 'text-danger' : '')

function Figure({ label, value, hint }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="vt-card h-100 p-3">
        <span className="text-secondary small d-block">{label}</span>
        <span className={`d-block lh-1 my-1 ${tone(value)}`} style={{ fontSize: '1.5rem' }}>{money(value)}</span>
        <span className="small text-secondary">{hint}</span>
      </div>
    </div>
  )
}

// Bought price vs selling price, and the profit between them. Staff see their own branch; admin sees every branch.
export default function Margins() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim())
  const { data: sum, error: sumError, reload: reloadSum } = useFetch('/margins/summary')
  const { data, total, loading, error, reload } = useFetch(`/margins?limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}`)
  const deliveries = `${WORKSPACE[user.role].home}/deliveries`

  return (
    <>
      <h1 className="h3 mb-1">Profit</h1>
      <p className="text-secondary">Average buying price comes from your deliveries. Profit is selling price minus that, before any loyalty discounts.</p>

      {sumError ? <ErrorState onRetry={reloadSum}>We could not load the totals.</ErrorState> : (
        <div className="row g-2 g-md-3 mb-4">
          {sum ? (
            <>
              <Figure label="Profit so far" value={sum.profitToDate} hint="paid orders with a known cost" />
              <Figure label="Last 30 days" value={sum.profitLast30Days} hint="profit on paid orders" />
              <Figure label="Stock on hand" value={sum.stockAtCost} hint={`cost; worth ${gbp(sum.stockAtPrice)} at shop prices`} />
              <Figure label="Bought, last 30 days" value={sum.spentLast30Days} hint="spent on deliveries" />
            </>
          ) : Array.from({ length: 4 }, (_, i) => <div key={i} className="col-6 col-xl-3"><Skeleton h="6rem" /></div>)}
        </div>
      )}

      <ListFilters q={q} onQ={setQ} shown={data?.length ?? 0} total={total} placeholder="Search products" />
      {error && <ErrorState onRetry={reload}>We could not load the products.</ErrorState>}
      {loading && !data && <div className="d-grid gap-2"><Skeleton h="6rem" /><Skeleton h="6rem" /></div>}
      {data && !data.length && <EmptyState icon="chart" title="No products found">Try a different search.</EmptyState>}
      {data && data.some((p) => p.cost == null) && (
        <p className="small text-secondary">Products showing “–” have no buying price yet. <Link to={deliveries}>Record a delivery</Link> to start tracking them.</p>
      )}

      {data?.length > 0 && (
        <>
          <div className="d-grid gap-2 d-md-none">
            {data.map((p) => (
              <div key={p.productId} className="vt-card p-3">
                <strong className="d-block mb-2">{p.name}</strong>
                <dl className="row small mb-0 gy-1">
                  {[['Bought for (average)', money(p.cost)], ['Sells at', gbp(p.sellPrice)], ['Profit each', p.unitProfit == null ? '–' : `${money(p.unitProfit)} (${pct(p.marginPct)})`],
                    ['In stock', p.inStock], ['Sold', p.sold], ['Profit so far', money(p.profitToDate)]].map(([k, v]) => (
                    <div key={k} className="col-12 d-flex justify-content-between gap-3"><dt className="fw-normal text-secondary">{k}</dt><dd className="mb-0 text-end">{v}</dd></div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <div className="vt-card d-none d-md-block table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead><tr><th>Product</th><th className="text-end">Bought for</th><th className="text-end">Sells at</th><th className="text-end">Profit each</th><th className="text-end">Margin</th><th className="text-end">In stock</th><th className="text-end">Sold</th><th className="text-end">Profit so far</th></tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}<span className="d-block small text-secondary">{p.condition}</span></td>
                    <td className="text-end">{money(p.cost)}</td>
                    <td className="text-end">{gbp(p.sellPrice)}</td>
                    <td className={`text-end ${tone(p.unitProfit)}`}>{money(p.unitProfit)}</td>
                    <td className={`text-end ${tone(p.marginPct)}`}>{pct(p.marginPct)}</td>
                    <td className="text-end">{p.inStock}</td>
                    <td className="text-end">{p.sold}</td>
                    <td className={`text-end ${tone(p.profitToDate)}`}>{money(p.profitToDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
