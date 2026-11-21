import useFetch from '../hooks/useFetch'
import { ErrorState } from './ui/primitives'

const since = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '')

// Admin home: which staff are active right now and at which branch (signed in, or clocked in at a till), with the IP of
// that sign-in. Replaces the "staff working here" column on the branch list, which showed last-used branches, not who is in.
export default function WorkingNow() {
  const { data, error, reload } = useFetch('/users/active')
  if (error) return <ErrorState onRetry={reload}>We could not load who is active.</ErrorState>
  if (!data) return null
  return (
    <div className="vt-card p-3 mb-3">
      <h2 className="h6 mb-2">Active now <span className="badge bg-success ms-1">{data.length}</span></h2>
      {!data.length && <p className="text-secondary small mb-0">Nobody is signed in or on shift.</p>}
      {data.map((s) => (
        <div key={s.userId} className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-1 border-bottom">
          <span>
            {s.name} <span className="small text-secondary">{s.branchName || 'No branch'}</span>
            {s.onShift && <span className="badge bg-success ms-2">On shift</span>}
          </span>
          <span className="small text-secondary font-monospace">{s.ip || '-'}{s.signedInAt ? ` · since ${since(s.signedInAt)}` : ''}</span>
        </div>
      ))}
    </div>
  )
}
