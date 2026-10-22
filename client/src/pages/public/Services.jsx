import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import Icon from '../../components/ui/Icon'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/primitives'
import { gbp } from '../../format'

// Service icons come from the database as names; map them to the app's own icon set.
const ICONS = { smartphone: 'phone', laptop: 'laptop', tablet: 'tablet', headphones: 'audio', watch: 'watch', wrench: 'wrench' }

export default function Services() {
  const { data, loading, error, reload } = useFetch('/services')
  return (
    <>
      <h1 className="h3 mb-1">Repairs</h1>
      <p className="text-secondary mb-4">Choose what needs fixing and book it in. You approve the price before any work starts.</p>
      {error && <ErrorState onRetry={reload}>We could not load the services.</ErrorState>}
      {loading && !data && <div className="d-grid gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h="5rem" />)}</div>}
      {data && !data.length && <EmptyState icon="wrench" title="No services listed yet" action={<Link to="/app/book" className="btn btn-primary">Book a repair anyway</Link>}>Tell us what is wrong when you book.</EmptyState>}
      <div className="row g-2 g-md-3">
        {data?.map((s) => (
          <div className="col-md-6" key={s.id}>
            <Link to={`/app/book?problem=${encodeURIComponent(s.title)}`} className="vt-card d-flex align-items-center gap-3 p-3 h-100">
              <span className="d-grid flex-none rounded-circle" style={{ placeItems: 'center', width: 52, height: 52, background: 'var(--vt-green-100)', color: 'var(--vt-green-700)' }}><Icon name={ICONS[s.icon] || 'wrench'} size={26} /></span>
              <span className="me-auto">
                <strong className="d-block">{s.title}</strong>
                <span className="text-secondary small">{s.description}</span>
                {s.basePrice > 0 && <span className="d-block small fw-semibold mt-1">From {gbp(s.basePrice)}</span>}
              </span>
              <Icon name="right" size={20} className="flex-none text-secondary" />
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}
