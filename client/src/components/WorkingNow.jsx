import useFetch from '../hooks/useFetch'
import { ErrorState } from './ui/primitives'

const since = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// Admin home: who is on shift right now, in every branch (shifts started on the dashboard or at the till).
export default function WorkingNow() {
  const { data, error, reload } = useFetch('/shifts/now')
  if (error) return <ErrorState onRetry={reload}>We could not load who is working.</ErrorState>
  if (!data) return null
  return (
    <div className="vt-card p-3 mb-3">
      <h2 className="h6 mb-2">Working now <span className="badge bg-success ms-1">{data.length}</span></h2>
      {!data.length && <p className="text-secondary small mb-0">Nobody has a shift running.</p>}
      {data.map((s) => (
        <div key={s.userId} className="d-flex justify-content-between gap-3 py-1 border-bottom">
          <span>{s.name} <span className="small text-secondary">{s.branchName}</span></span>
          <span className="small text-secondary">since {since(s.startedAt)}</span>
        </div>
      ))}
    </div>
  )
}
