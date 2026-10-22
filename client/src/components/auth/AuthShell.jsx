import { useState } from 'react'
import Icon from '../ui/Icon'
import { LogoMark } from '../ui/Logo'

// Shared frame for login and register: one calm column on phones, a card on bigger screens.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto" style={{ maxWidth: 440 }}>
      <div className="text-center mb-4 pt-2">
        <div className="d-inline-block mb-3"><LogoMark size={56} /></div>
        <h1 className="h2 mb-1">{title}</h1>
        {subtitle && <p className="text-secondary mb-0">{subtitle}</p>}
      </div>
      <div className="vt-card p-3 p-sm-4">{children}</div>
      {footer && <p className="text-center mt-3 mb-0">{footer}</p>}
    </div>
  )
}

// Password input with a show/hide button, so a typo on a phone keyboard is easy to spot and fix.
export function PasswordField({ id, label, value, onChange, autoComplete, hint, minLength, required = true }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="form-label" htmlFor={id}>{label}</label>
      <div className="input-group">
        <input id={id} className="form-control" type={show ? 'text' : 'password'} required={required} minLength={minLength} autoComplete={autoComplete} value={value} onChange={onChange} />
        <button type="button" className="btn btn-outline-secondary px-3" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </div>
      {hint && <div className="form-text">{hint}</div>}
    </div>
  )
}
