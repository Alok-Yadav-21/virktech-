import { useState } from 'react'
import { Modal } from 'react-bootstrap'

// fields: [{ name, label, type: text|password|number|textarea|select|choice|checkbox, options?, choices?, required? }]
// Parent sets `key` per record so state resets between Add and Edit.
export default function FormModal({ title, fields, initial, onSubmit, onHide }) {
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (name, v) => setValues((s) => ({ ...s, [name]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit(values) } catch { /* api.js already toasted the server message; keep the form open */ } finally { setBusy(false) }
  }

  const input = (f) => {
    const v = values[f.name] ?? ''
    const common = { id: f.name, required: f.required }
    if (f.type === 'checkbox') {
      return <div className="form-check"><input {...common} type="checkbox" className="form-check-input" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} /></div>
    }
    if (f.type === 'textarea') return <textarea {...common} className="form-control" rows={3} value={v} onChange={(e) => set(f.name, e.target.value)} />
    if (f.type === 'select') {
      return (
        <select {...common} className="form-select" value={v} onChange={(e) => set(f.name, e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Choose…</option>
          {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    if (f.type === 'choice') {
      return (
        <select {...common} className="form-select" value={v} onChange={(e) => set(f.name, e.target.value)}>
          {f.choices.map((c) => <option key={c}>{c}</option>)}
        </select>
      )
    }
    if (f.type === 'number') {
      // Blank sends null so an optional number (e.g. was price) can be cleared.
      return <input {...common} type="number" step="any" className="form-control" value={v} onChange={(e) => set(f.name, e.target.value === '' ? null : Number(e.target.value))} />
    }
    return <input {...common} type={f.type === 'password' ? 'password' : 'text'} autoComplete={f.type === 'password' ? 'new-password' : undefined} className="form-control" value={v} onChange={(e) => set(f.name, e.target.value)} />
  }

  return (
    <Modal show onHide={onHide} fullscreen="md-down" size="xl" scrollable centered>
      {/* The form sits between modal-content and modal-body, so it must be the flex column that lets the body scroll. */}
      <form onSubmit={submit} className="d-flex flex-column overflow-hidden" style={{ minHeight: 0, flex: '1 1 auto' }}>
        <Modal.Header closeButton><Modal.Title>{title}</Modal.Title></Modal.Header>
        <Modal.Body>
          {fields.map((f) => (
            <div className="mb-3" key={f.name}>
              <label htmlFor={f.name} className="form-label">{f.label}</label>
              {input(f)}
              {f.hint && <div className="form-text">{f.hint}</div>}
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-secondary" onClick={onHide}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>Save</button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
