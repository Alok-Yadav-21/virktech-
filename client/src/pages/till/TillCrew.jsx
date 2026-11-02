import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { ErrorState } from '../../components/ui/primitives'

// Clock in or out from the till: anyone at this branch types their own PIN. Names and "on shift" only, never times or pay.
export default function TillCrew({ onHide, onChanged }) {
  const { data, error, reload } = useFetch('/till/crew')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  const clock = async (action) => {
    setBusy(true)
    try {
      const r = await api.post('/till/clock', { pin, action })
      toast.success(`${r.data.name}: shift ${action === 'start' ? 'started' : 'ended'}`)
      reload()
      onChanged()
    } catch { /* api.js already toasted why */ } finally { setPin(''); setBusy(false) }
  }

  return (
    <Modal show onHide={onHide} size="lg" centered>
      <Modal.Header closeButton><Modal.Title>Shifts at this till</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <ErrorState onRetry={reload}>We could not load the team.</ErrorState>}
        {data?.map((c) => (
          <div key={c.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
            <span>{c.name}</span>
            <span className={`badge ${c.onShift ? 'bg-success' : 'bg-secondary'}`}>{c.onShift ? 'On shift' : 'Off'}</span>
          </div>
        ))}
        <label className="form-label mt-3" htmlFor="clock-pin">Type your PIN to start or end your own shift</label>
        <input id="clock-pin" className="form-control form-control-lg text-center mb-3" style={{ letterSpacing: '1rem' }} type="password" inputMode="numeric"
          autoComplete="off" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <div className="d-grid gap-2 d-sm-flex">
          <button className="btn btn-primary btn-lg flex-fill" disabled={busy || pin.length < 4} onClick={() => clock('start')}>Start shift</button>
          <button className="btn btn-outline-danger btn-lg flex-fill" disabled={busy || pin.length < 4} onClick={() => clock('end')}>End shift</button>
        </div>
      </Modal.Body>
    </Modal>
  )
}
