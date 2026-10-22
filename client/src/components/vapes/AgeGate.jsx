import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from 'react-bootstrap'

const KEY = 'vt_age_ok'
const confirmed = () => {
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false } // blocked storage: ask on every visit
}

// "Are you 18 or over?" before any vape page shows. Not proof of age: the server also needs the tick at checkout
// and staff check ID on collection. Remembered for this browser tab only.
export default function AgeGate() {
  const [ok, setOk] = useState(confirmed)
  const navigate = useNavigate()
  if (ok) return null
  const yes = () => {
    try { sessionStorage.setItem(KEY, '1') } catch { /* storage blocked: the gate shows again next page load */ }
    setOk(true)
  }
  return (
    <Modal show backdrop="static" keyboard={false} centered aria-labelledby="age-title">
      <Modal.Body className="text-center p-4">
        <h2 id="age-title" className="h4 mb-2">Are you 18 or over?</h2>
        <p className="text-secondary mb-4">Vaping products are only sold to adults. You will be asked to confirm again at checkout, and we check ID when you collect.</p>
        <div className="d-grid gap-2">
          <button className="btn btn-primary btn-lg" onClick={yes}>Yes, I am 18 or over</button>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>No, take me back</button>
        </div>
      </Modal.Body>
    </Modal>
  )
}
