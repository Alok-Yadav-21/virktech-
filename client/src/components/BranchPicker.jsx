import useFetch from '../hooks/useFetch'
import { ErrorState } from './ui/primitives'

// Shown once per device, after a correct PIN: the branch they pick is recorded with the sign-in and remembered on this device.
export default function BranchPicker({ onPick, onCancel, busy = false }) {
  const { data, error, reload } = useFetch('/branches')
  return (
    <div className="mx-auto" style={{ maxWidth: 360 }}>
      <p className="fw-semibold text-center mb-1">Which branch are you working at?</p>
      <p className="text-center small text-secondary mb-3">This device will remember it, so you are only asked once.</p>
      {error && <ErrorState onRetry={reload}>We could not load the branches.</ErrorState>}
      <div className="d-grid gap-2">
        {data?.map((b) => <button key={b.id} type="button" className="btn btn-outline-primary btn-lg" disabled={busy} onClick={() => onPick(b.id, b.area)}>{b.area}</button>)}
      </div>
      <button type="button" className="btn btn-link w-100 mt-3" onClick={onCancel}>Back</button>
    </div>
  )
}
