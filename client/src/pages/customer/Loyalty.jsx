import useFetch from '../../hooks/useFetch'
import BackLink from '../../components/ui/BackLink'
import Icon from '../../components/ui/Icon'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'
import { LOYALTY } from '../../constants'
import { gbp, when } from '../../format'

const KIND = { earned: 'Earned', redeemed: 'Used', adjusted: 'Adjustment' }

export default function Loyalty() {
  const { data, loading, error, reload } = useFetch('/loyalty/me')
  if (loading && !data) return <div className="d-grid gap-3"><Skeleton h="9rem" /><Skeleton h="4rem" /><Skeleton h="4rem" /></div>
  if (error) return <ErrorState onRetry={reload}>We could not load your points.</ErrorState>
  const pts = data.balance
  const steps = Math.floor(pts / LOYALTY.STEP_POINTS)
  const toNext = LOYALTY.STEP_POINTS - (pts % LOYALTY.STEP_POINTS)

  return (
    <>
      <BackLink to="/app/me">Me</BackLink>
      <h1 className="h3 mb-3">Rewards</h1>

      <section className="vt-band p-4 mb-3" aria-label="Your points">
        <p className="mb-0">Your points</p>
        <p className="vt-price text-white mb-1" style={{ fontSize: '3rem', lineHeight: 1 }}>{pts}</p>
        <p className="mb-3">{steps > 0 ? `Worth ${gbp(steps * LOYALTY.STEP_VALUE)} off your next order or repair.` : 'Keep going: your first reward is close.'}</p>
        <div className="progress" style={{ '--bs-progress-bg': 'rgb(255 255 255 / 0.25)', '--bs-progress-bar-bg': 'var(--vt-lime)' }} role="progressbar" aria-label="Progress to your next reward" aria-valuenow={(pts % LOYALTY.STEP_POINTS) * 10} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width: `${(pts % LOYALTY.STEP_POINTS) * 10}%` }} /></div>
        <p className="small mt-2 mb-0">{toNext} more {toNext === 1 ? 'point' : 'points'} for another {gbp(LOYALTY.STEP_VALUE)}.</p>
      </section>

      <section className="vt-card p-3 mb-4" aria-label="How points work">
        <h2 className="h6 mb-3">How it works</h2>
        <ul className="list-unstyled d-grid gap-2 mb-0">
          <li className="d-flex gap-2"><Icon name="gift" size={20} className="flex-none text-success" />Earn 5 points for every full £10 you spend on an order over £10, and on completed repairs.</li>
          <li className="d-flex gap-2"><Icon name="clock" size={20} className="flex-none text-success" />Points arrive once your order is collected or delivered, or your repair is complete.</li>
          <li className="d-flex gap-2"><Icon name="tag" size={20} className="flex-none text-success" />Every 10 points is {gbp(LOYALTY.STEP_VALUE)} off, up to 20% of a bill. Use them at checkout, or ask at the counter for a repair.</li>
        </ul>
      </section>

      <h2 className="h5 mb-3">Activity</h2>
      {!data.entries.length
        ? <EmptyState icon="gift" title="No activity yet">Your points will show up here as you earn and use them.</EmptyState>
        : (
          <ul className="list-unstyled vt-card mb-0" style={{ overflow: 'hidden' }}>
            {data.entries.map((e) => (
              <li key={e.id} className="d-flex align-items-center gap-3 p-3 border-bottom">
                <span className="vt-row-icon" style={e.delta < 0 ? { background: 'var(--vt-green-50)', color: 'var(--vt-muted)' } : undefined}><Icon name={e.delta > 0 ? 'plus' : 'minus'} size={20} /></span>
                <span className="me-auto min-w-0">
                  <strong className="d-block">{KIND[e.kind]}{e.sourceRef && e.sourceRef !== 'ADMIN' && e.sourceRef !== 'COUNTER' ? ` · ${e.sourceRef}` : ''}</strong>
                  <span className="small text-secondary d-block">{e.note ? `${e.note} · ` : ''}{when(e.createdAt)}</span>
                </span>
                <span className="vt-price" style={{ color: e.delta > 0 ? 'var(--vt-green-700)' : 'var(--vt-ink)' }}>{e.delta > 0 ? '+' : ''}{e.delta}</span>
              </li>
            ))}
          </ul>
        )}
    </>
  )
}
