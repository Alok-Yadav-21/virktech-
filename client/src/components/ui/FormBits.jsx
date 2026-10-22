import Icon from './Icon'
import { Chip } from './primitives'
import { DEVICE_CATEGORIES } from '../../constants'

const DEVICE_ICON = { Phone: 'phone', Laptop: 'laptop', Tablet: 'tablet', Audio: 'audio', Wearable: 'watch', Other: 'box' }

// A titled card for one part of a form, so long forms read as a few short steps on a phone.
export function FormSection({ title, hint, children }) {
  return (
    <section className="vt-card p-3 p-md-4 mb-3">
      <h2 className="vt-section-title mb-1">{title}</h2>
      {hint && <p className="small text-secondary mb-3">{hint}</p>}
      {!hint && <div className="mb-2" />}
      {children}
    </section>
  )
}

export function DevicePicker({ value, onChange }) {
  return (
    <div className="vt-rail" role="group" aria-label="Device type">
      {DEVICE_CATEGORIES.map((c) => (
        <Chip key={c} active={value === c} onClick={() => onChange(c)}><Icon name={DEVICE_ICON[c]} size={20} />{c}</Chip>
      ))}
    </div>
  )
}

// Radio cards: big targets with a one-line explanation, better than a dropdown for a choice with three options.
export function ChoiceCards({ name, value, onChange, options }) {
  return (
    <div className="d-grid gap-2" role="radiogroup">
      {options.map(([v, label, text]) => (
        <label key={v} className="vt-choice">
          <input type="radio" name={name} className="form-check-input mt-0" checked={value === v} onChange={() => onChange(v)} />
          <span><strong className="d-block">{label}</strong>{text && <span className="small text-secondary">{text}</span>}</span>
        </label>
      ))}
    </div>
  )
}

// Fixed bottom submit bar on phones (above the tab bar); a normal button row on desktop.
export function SubmitBar({ busy, label, busyLabel, note }) {
  return (
    <>
      <div className="d-md-none" style={{ height: '5.5rem' }} aria-hidden="true" />
      <div className="vt-bar">
        <div className="container">
          {note && <p className="small text-secondary mb-2 text-center d-none d-md-block">{note}</p>}
          <button className="btn btn-primary btn-lg w-100" disabled={busy}>{busy ? busyLabel : label}</button>
        </div>
      </div>
    </>
  )
}
