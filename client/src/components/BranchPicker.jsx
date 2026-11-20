import useFetch from '../hooks/useFetch'
import { ErrorState } from './ui/primitives'

// Shown after a correct PIN from an IP no branch has saved: the branch they pick is recorded with the sign-in.
export default function BranchPicker({ onPick, onCancel, busy = false }) {
  const { data, error, reload } = useFetch('/branches')
  return (
    <div className="mx-auto" style={{ maxWidth: 360 }}>
      <p className="fw-semibold text-center mb-3">Which branch are you working at?</p>
      {error && <ErrorState onRetry={reload}>We could not load the branches.</ErrorState>}
      <div className="d-grid gap-2">
        {data?.map((b) => <button key={b.id} type="button" className="btn btn-outline-primary btn-lg" disabled={busy} onClick={() => onPick(b.id)}>{b.area}</button>)}
      </div>
      <button type="button" className="btn btn-link w-100 mt-3" onClick={onCancel}>Back</button>
    </div>
  )
}
