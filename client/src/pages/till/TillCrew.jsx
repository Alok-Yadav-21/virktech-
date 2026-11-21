import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { ErrorState } from '../../components/ui/primitives'
import PinPad from '../../components/PinPad'

// Clock in or out from the till: anyone at this branch taps their own PIN. Lists who is on shift (names only, never times or pay).
export default function TillCrew({ me, onHide, onChanged }) {
  const { data, error, reload } = useFetch('/till/crew')
  const [busy, setBusy] = useState(false)

  // No Start/End buttons: the server flips it, so typing your PIN starts your shift when you are off and ends it when you are on.
  const clock = async (pin) => {
    setBusy(true)
    try {
      const r = await api.post('/till/clock', { pin, action: 'toggle' })
      toast.success(`${r.data.name}: shift ${r.data.action === 'start' ? 'started' : 'ended'}`)
      if (r.data.holder.id !== me.id) toast(`The till is now under ${r.data.holder.name}`)
      reload()
      onChanged()
    } catch { /* api.js already toasted why */ } finally { setBusy(false) }
  }

  return (
    <Modal show onHide={onHide} size="lg" centered>
      <Modal.Header closeButton><Modal.Title>Shifts at this till</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <ErrorState onRetry={reload}>We could not load the team.</ErrorState>}
        {/* Only people who are on shift: a list of everyone with "Off" beside most of them was noise. Anyone off shift starts with their PIN below. */}
        {data && !data.some((c) => c.onShift) && <p className="text-secondary mb-0">Nobody is on shift.</p>}
        {data?.filter((c) => c.onShift).map((c) => (
          <div key={c.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
            <span>{c.name}</span>
            <span className="badge bg-success">On shift</span>
          </div>
        ))}
        <p className="mt-3 mb-3 text-center fw-semibold">Tap your PIN to start or end your own shift</p>
        <PinPad onComplete={clock} disabled={busy} />
      </Modal.Body>
    </Modal>
  )
}
