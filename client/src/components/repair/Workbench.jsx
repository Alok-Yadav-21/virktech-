import { useState } from 'react'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { REPAIR_STATUS as S } from '../../constants'
import { gbp, when } from '../../format'

// Staff/admin controls. The server sends `allowed` so the dropdown can never offer an illegal move.
export default function Workbench({ repair, act, isAdmin }) {
  const url = `/repairs/${repair.reference}`
  const [status, setStatus] = useState('')
  const [reason, setReason] = useState('')
  const [quote, setQuote] = useState(repair.quote ?? '')
  const [note, setNote] = useState({ text: '', visibleToCustomer: false })
  const [part, setPart] = useState({ name: '', cost: '' })
  const closed = !repair.allowed.length
  const quoteLocked = closed || repair.history.some((h) => h.status === S.QUOTE)
  const partsTotal = repair.parts.reduce((sum, p) => sum + p.cost, 0)

  return (
    <>
      <div className="card mb-3"><div className="card-body">
        <h6>Update status</h6>
        {closed ? <p className="text-muted mb-0">This repair is closed.</p> : (
          <>
            <select className="form-select mb-2" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Move to…</option>
              {repair.allowed.map((s) => <option key={s}>{s}</option>)}
            </select>
            {status === S.CANCELLED && <input className="form-control mb-2" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />}
            <button className="btn btn-primary" disabled={!status}
              onClick={() => act(api.patch(`${url}/status`, { status, reason }), 'Status updated').then((ok) => { if (ok) { setStatus(''); setReason('') } })}>
              Update
            </button>
            {repair.status === S.QUOTE && <p className="small text-muted mt-2 mb-0">Waiting for the customer to approve or decline.</p>}
          </>
        )}
      </div></div>

      <div className="card mb-3"><div className="card-body">
        <h6>Quote</h6>
        {quoteLocked ? <p className="mb-0">{repair.quote != null ? `${gbp(repair.quote)} (sent)` : 'None'}</p> : (
          <div className="input-group">
            <span className="input-group-text">£</span>
            <input className="form-control" type="number" min="0" step="0.01" value={quote} onChange={(e) => setQuote(e.target.value)} />
            <button className="btn btn-outline-primary" disabled={!(Number(quote) > 0)} onClick={() => act(api.patch(`${url}/quote`, { quote: Number(quote) }), 'Quote saved')}>Save</button>
          </div>
        )}
      </div></div>

      <div className="card mb-3"><div className="card-body">
        <h6>Payment</h6>
        {repair.paymentStatus === 'paid' && <p className="mb-0 text-success">Paid {gbp(repair.amountDue)} · {when(repair.paidAt)}</p>}
        {repair.paymentStatus === 'refunded' && <p className="mb-0 text-muted">Refunded (repair was cancelled after payment)</p>}
        {repair.paymentStatus === 'unpaid' && (
          [S.READY, S.DISPATCHED].includes(repair.status) && repair.quote != null
            ? <button className="btn btn-success w-100" onClick={() => act(api.patch(`${url}/pay`), 'Marked as paid')}>Mark as paid ({gbp(repair.amountDue)})</button>
            : <p className="text-muted mb-0">Take payment once the repair is ready for collection. A repair cannot be completed until it is paid.</p>
        )}
      </div></div>

      {isAdmin && <TechnicianPicker repair={repair} act={act} />}

      <div className="card mb-3"><div className="card-body">
        <h6>Parts {repair.parts.length > 0 && <small className="text-muted">({gbp(partsTotal)})</small>}</h6>
        <ul className="list-unstyled small">{repair.parts.map((p, i) => <li key={i}>{p.name} - {gbp(p.cost)}</li>)}</ul>
        <div className="input-group">
          <input className="form-control" placeholder="Part" value={part.name} onChange={(e) => setPart({ ...part, name: e.target.value })} />
          <input className="form-control" type="number" min="0" step="0.01" placeholder="Cost" value={part.cost} onChange={(e) => setPart({ ...part, cost: e.target.value })} />
          <button className="btn btn-outline-primary" disabled={!part.name.trim() || part.cost === ''}
            onClick={() => act(api.post(`${url}/parts`, { name: part.name, cost: Number(part.cost) }), 'Part added').then((ok) => ok && setPart({ name: '', cost: '' }))}>Add</button>
        </div>
      </div></div>

      <div className="card mb-3"><div className="card-body">
        <h6>Notes</h6>
        {repair.notes.map((n, i) => (
          <div key={i} className="small mb-2">
            <div>{n.text} {n.visibleToCustomer && <span className="badge text-bg-info">customer can see</span>}</div>
            <div className="text-muted">{n.by} · {when(n.at)}</div>
          </div>
        ))}
        <textarea className="form-control mb-2" rows={2} placeholder="Add a note" value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
        <div className="form-check mb-2">
          <input id="vis" className="form-check-input" type="checkbox" checked={note.visibleToCustomer} onChange={(e) => setNote({ ...note, visibleToCustomer: e.target.checked })} />
          <label htmlFor="vis" className="form-check-label">Visible to customer</label>
        </div>
        <button className="btn btn-outline-primary" disabled={!note.text.trim()}
          onClick={() => act(api.post(`${url}/notes`, note), 'Note added').then((ok) => ok && setNote({ text: '', visibleToCustomer: false }))}>Add note</button>
      </div></div>
    </>
  )
}

function TechnicianPicker({ repair, act }) {
  const { data: staff } = useFetch(`/users?role=staff&branchId=${repair.branch.id}`)
  const [pick, setPick] = useState(repair.technician?.id ?? '')
  return (
    <div className="card mb-3"><div className="card-body">
      <h6>Technician</h6>
      <div className="input-group">
        <select className="form-select" value={pick} onChange={(e) => setPick(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Unassigned</option>
          {staff?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn btn-outline-primary" onClick={() => act(api.patch(`/repairs/${repair.reference}/technician`, { technicianId: pick === '' ? null : pick }), 'Technician saved')}>Assign</button>
      </div>
    </div></div>
  )
}
