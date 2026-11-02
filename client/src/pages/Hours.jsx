import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import toast from 'react-hot-toast'
import api from '../api'
import useFetch from '../hooks/useFetch'
import { useAuth } from '../context/AuthContext'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/primitives'
import { gbp, hours } from '../format'

const day = (d) => d.toLocaleDateString('en-CA') // YYYY-MM-DD in the browser's own time
const time = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const date = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const money = (n) => (n == null ? 'no wage set' : gbp(n))
// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
const local = (d) => `${day(new Date(d))}T${new Date(d).toTimeString().slice(0, 5)}`

function Figure({ label, value }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="vt-card p-3 h-100"><span className="text-secondary small d-block">{label}</span><span className="fs-4">{value}</span></div>
    </div>
  )
}

// Admin: set when a forgotten shift really ended.
function FixEnd({ shift, onDone, onHide }) {
  const [value, setValue] = useState(local(shift.endedAt || new Date()))
  const [busy, setBusy] = useState(false)
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch(`/shifts/${shift.id}`, { endedAt: new Date(value).toISOString() })
      toast.success('Shift updated')
      onDone()
    } catch { /* api.js already toasted why */ } finally { setBusy(false) }
  }
  return (
    <Modal show onHide={onHide} size="lg" centered>
      <form onSubmit={save}>
        <Modal.Header closeButton><Modal.Title>{shift.staffName}: {date(shift.startedAt)}</Modal.Title></Modal.Header>
        <Modal.Body>
          <p className="small text-secondary">Started {time(shift.startedAt)}. Set the time this shift really ended.</p>
          <label className="form-label" htmlFor="end">Ended at</label>
          <input id="end" type="datetime-local" required className="form-control" value={value} onChange={(e) => setValue(e.target.value)} />
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onHide}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>Save</button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

// Days worked and pay (one day's wage per day worked, using the rate stored on that day's first shift). Staff get their own; admin gets everyone.
export default function Hours() {
  const { user } = useAuth()
  const admin = user.role === 'admin'
  const now = new Date()
  const [from, setFrom] = useState(day(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [to, setTo] = useState(day(now))
  const [staffId, setStaffId] = useState('')
  const [fixing, setFixing] = useState(null)
  const { data, loading, error, reload } = useFetch(`/shifts?from=${from}&to=${to}${staffId ? `&userId=${staffId}` : ''}`)
  const { data: people } = useFetch(admin ? '/users?role=staff&limit=500' : null)

  return (
    <>
      <h1 className="h3 mb-1">{admin ? 'Staff hours and wages' : 'My hours and wages'}</h1>
      <p className="text-secondary">Pay is one daily wage for every day you work, however many hours, at the rate set when the day's first shift started. It is before tax. Hours are shown for your records.</p>

      <div className="row g-2 mb-3">
        <div className="col-6 col-md-3"><label className="form-label small" htmlFor="from">From</label><input id="from" type="date" className="form-control" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
        <div className="col-6 col-md-3"><label className="form-label small" htmlFor="to">To</label><input id="to" type="date" className="form-control" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>
        {admin && (
          <div className="col-12 col-md-4">
            <label className="form-label small" htmlFor="who">Staff member</label>
            <select id="who" className="form-select" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Everyone</option>
              {(people || []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.branchName})</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <ErrorState onRetry={reload}>We could not load the hours.</ErrorState>}
      {loading && !data && <Skeleton h="6rem" />}
      {data && (
        <>
          <div className="row g-2 g-md-3 mb-3">
            <Figure label="Days worked" value={data.totals.days} />
            <Figure label="Total hours" value={hours(data.totals.minutes)} />
            <Figure label="Total pay" value={gbp(data.totals.pay) || '£0'} />
          </div>

          {admin && data.staff.length > 1 && (
            <div className="vt-card table-responsive mb-3">
              <table className="table align-middle mb-0">
                <thead><tr><th>Staff</th><th className="text-end">Days</th><th className="text-end">Hours</th><th className="text-end">Pay</th></tr></thead>
                <tbody>{data.staff.map((t) => <tr key={t.userId}><td>{t.name}</td><td className="text-end">{t.days}</td><td className="text-end">{hours(t.minutes)}</td><td className="text-end">{gbp(t.pay) || '£0'}</td></tr>)}</tbody>
              </table>
            </div>
          )}

          {!data.shifts.length && <EmptyState icon="list" title="No shifts in this period">Try a wider date range.</EmptyState>}
          {data.shifts.length > 0 && (
            <div className="vt-card table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>Day</th>{admin && <th>Staff</th>}<th>Start</th><th>End</th><th className="text-end">Hours</th><th className="text-end">Day rate</th><th className="text-end">Pay</th>{admin && <th />}</tr></thead>
                <tbody>
                  {data.shifts.map((s) => (
                    <tr key={s.id}>
                      <td>{date(s.startedAt)}</td>
                      {admin && <td>{s.staffName}<span className="d-block small text-secondary">{s.branchName}</span></td>}
                      <td>{time(s.startedAt)}</td>
                      <td>{s.running ? <span className="badge bg-success">Running</span> : time(s.endedAt)}</td>
                      <td className="text-end">{hours(s.minutes)}</td>
                      <td className="text-end">{s.dailyWage == null ? '-' : `${gbp(s.dailyWage)}/day`}</td>
                      <td className="text-end">{s.earnsDay ? money(s.pay) : <span className="small text-secondary">same day</span>}</td>
                      {admin && <td className="text-end"><button className="btn btn-sm btn-outline-primary" onClick={() => setFixing(s)}>Fix end</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {fixing && <FixEnd shift={fixing} onHide={() => setFixing(null)} onDone={() => { setFixing(null); reload() }} />}
    </>
  )
}
