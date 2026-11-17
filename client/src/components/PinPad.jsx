import { useEffect, useRef, useState } from 'react'

// On-screen 4-digit PIN keypad for touch screens. There is no <input>, so the tablet's own keyboard never opens.
// Calls onComplete(pin) at the 4th digit, then clears itself so a wrong PIN can be retyped at once.
// A physical keyboard or USB number pad also works (digits, Backspace, Escape).
export default function PinPad({ onComplete, disabled = false }) {
  const [pin, setPin] = useState('')
  const done = useRef(onComplete)
  done.current = onComplete // always call the newest callback

  const press = (d) => {
    if (disabled) return
    const next = (pin + d).slice(0, 4)
    if (next.length === 4) { setPin(''); done.current(next) } else setPin(next)
  }
  const back = () => setPin((p) => p.slice(0, -1))

  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
      else if (e.key === 'Escape') setPin('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const key = (label, onClick, extra = 'btn-outline-secondary', aria) => (
    <div className="col-4" key={label}>
      <button type="button" className={`btn ${extra} w-100 fs-3 fw-semibold`} style={{ height: 72 }} disabled={disabled} onClick={onClick} aria-label={aria}>{label}</button>
    </div>
  )

  return (
    <div className="mx-auto" style={{ maxWidth: 320 }}>
      <div className="d-flex justify-content-center gap-3 mb-4" role="status" aria-label={`${pin.length} of 4 digits typed`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`rounded-circle border border-2 border-primary ${i < pin.length ? 'bg-primary' : ''}`} style={{ width: 20, height: 20 }} />
        ))}
      </div>
      <div className="row g-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => key(String(n), () => press(String(n)), 'btn-outline-primary'))}
        {key('Clear', () => setPin(''), 'btn-light fs-5', 'Clear')}
        {key('0', () => press('0'), 'btn-outline-primary')}
        {key('⌫', back, 'btn-light', 'Delete last digit')}
      </div>
    </div>
  )
}
