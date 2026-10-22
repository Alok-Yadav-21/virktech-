import { Link } from 'react-router-dom'
import useFetch from '../../hooks/useFetch'
import Icon from '../../components/ui/Icon'
import { ErrorState, Skeleton } from '../../components/ui/primitives'

// No contact form: nothing sends email behind the app, so visitors are pointed at the branches instead.
export default function Contact() {
  const { data, loading, error, reload } = useFetch('/branches')
  return (
    <>
      <h1 className="h3 mb-1">Contact us</h1>
      <p className="text-secondary mb-4">The quickest way to reach us is to call or visit your nearest branch. <Link to="/branches">Find the nearest on the map.</Link></p>
      {error && <ErrorState onRetry={reload}>We could not load the branches.</ErrorState>}
      <div className="row g-3">
        {loading && !data && Array.from({ length: 6 }, (_, i) => <div key={i} className="col-md-6 col-lg-4"><Skeleton h="8rem" /></div>)}
        {data?.map((b) => (
          <div className="col-md-6 col-lg-4" key={b.id}>
            <div className="vt-card p-3 h-100">
              <h2 className="h6 mb-0">{b.area}</h2>
              <p className="text-secondary small mb-2">{b.name}</p>
              <p className="mb-3 small">{b.address}, {b.postcode}</p>
              <div className="d-flex flex-wrap gap-2">
                {b.lat != null && <a className="btn btn-sm btn-outline-secondary" href={`https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`} target="_blank" rel="noreferrer noopener"><Icon name="arrow" size={16} />Directions</a>}
                {b.phone && <a className="btn btn-sm btn-outline-secondary" href={`tel:${b.phone.replace(/\s/g, '')}`}><Icon name="phone" size={16} />{b.phone}</a>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
