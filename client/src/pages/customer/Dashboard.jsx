import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import Icon from '../../components/ui/Icon'
import RowCard from '../../components/ui/RowCard'
import RepairProgress from '../../components/repair/RepairProgress'
import { ErrorState, SectionHead, Skeleton, StatusPill } from '../../components/ui/primitives'
import { LOYALTY, OPEN, ORDER_CUSTOMER_LABELS, ORDER_TONE, REPAIR_STATUS, TRADEIN_CUSTOMER_LABELS, TRADEIN_TONE } from '../../constants'
import { gbp, plural } from '../../format'

function Attention({ to, title, text }) {
  return (
    <Link to={to} className="vt-card vt-card--attention d-flex align-items-center gap-3 p-3 mb-2">
      <Icon name="alert" size={26} className="flex-none" />
      <span className="me-auto"><strong className="d-block">{title}</strong><span className="small">{text}</span></span>
      <Icon name="right" size={20} className="flex-none" />
    </Link>
  )
}

export default function CustomerDashboard() {
  const { user } = useAuth()
  const { branch, openPicker } = useBranch()
  const stats = useFetch('/dashboard/stats')
  const repairs = useFetch('/repairs?limit=20')
  const orders = useFetch('/orders?limit=20')
  const trades = useFetch('/tradeins?limit=20')

  const failed = stats.error || repairs.error || orders.error || trades.error
  const loading = [stats, repairs, orders, trades].some((x) => x.loading && !x.data)
  const openRepairs = (repairs.data || []).filter((r) => OPEN.repairs(r.status))
  const openOrders = (orders.data || []).filter((o) => OPEN.orders(o.status))
  const openTrades = (trades.data || []).filter((t) => OPEN.tradeins(t.status))
  const quote = openRepairs.find((r) => r.status === REPAIR_STATUS.QUOTE)
  const offer = openTrades.find((t) => t.status === 'offer_sent')
  const points = stats.data?.loyaltyPoints ?? user.loyaltyPoints
  const nothing = !loading && !openRepairs.length && !openOrders.length && !openTrades.length

  return (
    <>
      <h1 className="h3 mb-1">Hi, {user.name.split(' ')[0]}</h1>
      <button type="button" className="btn btn-link p-0 mb-3 d-inline-flex align-items-center gap-1 text-secondary" onClick={openPicker}>
        <Icon name="pin" size={16} />{branch ? `Collecting from ${branch.area}` : 'Choose your branch'}<Icon name="down" size={14} />
      </button>

      {failed && <ErrorState onRetry={() => [stats, repairs, orders, trades].forEach((x) => x.reload())}>We could not load everything.</ErrorState>}

      {quote && <Attention to={`/app/repairs/${quote.reference}`} title="Your repair quote is ready" text={`${[quote.device.brand, quote.device.model].filter(Boolean).join(' ')}: ${gbp(quote.quote)}. Review and approve it.`} />}
      {offer && <Attention to={`/app/tradeins/${offer.reference}`} title="Your trade-in offer is ready" text={`${[offer.device.brand, offer.device.model].filter(Boolean).join(' ')}: ${gbp(offer.finalOffer)}. Accept or decline.`} />}

      <div className="row g-2 my-3">
        <div className="col-4"><Link to="/app/book" className="vt-tilebtn vt-tilebtn--fill"><Icon name="wrench" size={26} />Book a repair</Link></div>
        <div className="col-4"><Link to="/app/sell" className="vt-tilebtn"><Icon name="swap" size={26} />Sell a device</Link></div>
        <div className="col-4"><Link to="/shop" className="vt-tilebtn"><Icon name="bag" size={26} />Shop</Link></div>
      </div>

      {loading && <div className="d-grid gap-2"><Skeleton h="6.5rem" /><Skeleton h="4.5rem" /></div>}

      {openRepairs.length > 0 && (
        <section className="mb-4" aria-labelledby="repairs-title">
          <SectionHead title={<span id="repairs-title">Repairs</span>} to="/app/repairs" />
          <div className="d-grid gap-2">{openRepairs.slice(0, 3).map((r) => <RepairProgress key={r.reference} repair={r} to={`/app/repairs/${r.reference}`} />)}</div>
        </section>
      )}

      {openOrders.length > 0 && (
        <section className="mb-4" aria-labelledby="orders-title">
          <SectionHead title={<span id="orders-title">Orders</span>} to="/app/orders" />
          <div className="d-grid gap-2">
            {openOrders.slice(0, 3).map((o) => (
              <RowCard key={o.reference} to={`/app/orders/${o.reference}`} icon="receipt" title={o.reference}
                subtitle={`${plural(o.items.reduce((n, i) => n + i.qty, 0), 'item')} · ${gbp(o.total)}`} meta={o.deliveryMethod === 'delivery' ? 'Delivery' : `Collect from ${o.branch.area}`}
                right={<StatusPill tone={ORDER_TONE[o.status]}>{ORDER_CUSTOMER_LABELS[o.status]}</StatusPill>} />
            ))}
          </div>
        </section>
      )}

      {openTrades.length > 0 && (
        <section className="mb-4" aria-labelledby="trades-title">
          <SectionHead title={<span id="trades-title">Trade-ins</span>} to="/app/tradeins" />
          <div className="d-grid gap-2">
            {openTrades.slice(0, 3).map((t) => (
              <RowCard key={t.reference} to={`/app/tradeins/${t.reference}`} icon="swap" title={[t.device.brand, t.device.model].filter(Boolean).join(' ')} subtitle={t.reference}
                right={<StatusPill tone={TRADEIN_TONE[t.status]}>{TRADEIN_CUSTOMER_LABELS[t.status]}</StatusPill>} />
            ))}
          </div>
        </section>
      )}

      {nothing && (
        <div className="vt-card vt-card--tint p-4 text-center mb-4">
          <p className="fw-semibold mb-1">Nothing in progress</p>
          <p className="text-secondary small mb-0">When you book a repair or place an order, you can follow it here.</p>
        </div>
      )}

      <Link to="/app/loyalty" className="vt-card vt-card--tint d-block p-3 mb-3">
        <div className="d-flex align-items-center gap-3">
          <span className="vt-row-icon" style={{ background: 'var(--vt-green-600)', color: '#fff' }}><Icon name="gift" size={22} /></span>
          <span className="me-auto">
            <strong className="d-block">{points} loyalty points</strong>
            <span className="small text-secondary">
              {points >= LOYALTY.STEP_POINTS
                ? `Worth ${gbp(Math.floor(points / LOYALTY.STEP_POINTS) * LOYALTY.STEP_VALUE)} off. ${LOYALTY.STEP_POINTS - (points % LOYALTY.STEP_POINTS)} more for another ${gbp(LOYALTY.STEP_VALUE)}.`
                : `${LOYALTY.STEP_POINTS - points} more points for ${gbp(LOYALTY.STEP_VALUE)} off.`}
            </span>
          </span>
          <Icon name="right" size={18} className="flex-none text-secondary" />
        </div>
        <div className="progress mt-3" style={{ '--bs-progress-bg': '#fff' }} role="progressbar" aria-label="Progress to your next reward" aria-valuenow={(points % LOYALTY.STEP_POINTS) * 10} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width: `${(points % LOYALTY.STEP_POINTS) * 10}%` }} /></div>
      </Link>
    </>
  )
}
