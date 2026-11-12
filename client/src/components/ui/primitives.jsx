import { Link } from 'react-router-dom'
import { Offcanvas } from 'react-bootstrap'
import Icon from './Icon'
import { gbp } from '../../format'

export function Skeleton({ w = '100%', h = '1rem', circle = false, className = '', style }) {
  return <span className={`vt-skeleton ${className}`} style={{ width: w, height: h, borderRadius: circle ? '50%' : undefined, ...style }} aria-hidden="true" />
}

// Honest empty state: say what is missing and what to do about it.
export function EmptyState({ icon = 'info', title, children, action }) {
  return (
    <div className="text-center py-5 px-3">
      <div className="d-inline-grid rounded-circle mb-3" style={{ placeItems: 'center', width: 72, height: 72, background: 'var(--vt-green-50)', color: 'var(--vt-green-700)' }}>
        <Icon name={icon} size={32} />
      </div>
      <h2 className="h5 mb-1">{title}</h2>
      {children && <p className="text-secondary mb-3 mx-auto" style={{ maxWidth: '32ch' }}>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ children = 'Something went wrong loading this. Please try again.', onRetry }) {
  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3" role="alert">
      <span className="d-flex align-items-center gap-2"><Icon name="alert" size={20} />{children}</span>
      {onRetry && <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>Retry</button>}
    </div>
  )
}

// Icon + words, so status never depends on colour alone.
export function Pill({ tone = 'neutral', icon, children }) {
  return (
    <span className={`vt-pill ${tone === 'neutral' ? '' : `vt-pill--${tone}`}`}>
      {icon && <Icon name={icon} size={14} />}{children}
    </span>
  )
}

const TONE_ICON = { success: 'check', warn: 'alert', danger: 'x' }

// A status as a pill. `tone` comes from the *_TONE maps in constants.js; the label is always words.
export function StatusPill({ tone = 'neutral', children }) {
  return <Pill tone={tone} icon={TONE_ICON[tone]}>{children}</Pill>
}

export function Price({ price, was, size = '1.1rem' }) {
  const off = was && was > price ? Math.round((1 - price / was) * 100) : 0
  return (
    <span className="d-inline-flex align-items-baseline flex-wrap gap-1">
      <span className="vt-price" style={{ fontSize: size }}>{gbp(price)}</span>
      {off > 0 && <span className="vt-price-was">{gbp(was)}</span>}
      {off > 0 && <span className="vt-deal">-{off}%</span>}
    </span>
  )
}

export function QtyStepper({ value, onChange, min = 1, max = 99, label = 'Quantity' }) {
  return (
    <div className="vt-qty" role="group" aria-label={label}>
      <button type="button" aria-label="One fewer" disabled={value <= min} onClick={() => onChange(value - 1)}><Icon name="minus" size={18} /></button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label="One more" disabled={value >= max} onClick={() => onChange(value + 1)}><Icon name="plus" size={18} /></button>
    </div>
  )
}

export function SectionHead({ title, to, linkLabel = 'See all' }) {
  return (
    <div className="d-flex align-items-end justify-content-between gap-3 mb-3">
      <h2 className="h4 mb-0">{title}</h2>
      {to && <Link to={to} className="fw-semibold text-nowrap d-inline-flex align-items-center gap-1" style={{ minHeight: 44 }}>{linkLabel}<Icon name="right" size={16} /></Link>}
    </div>
  )
}

// Bottom sheet on phones (Offcanvas from the bottom). Content scrolls; the footer stays put.
export function Sheet({ show, onHide, title, children, footer }) {
  return (
    <Offcanvas show={show} onHide={onHide} placement="bottom" aria-labelledby="sheet-title">
      <Offcanvas.Header closeButton>
        <Offcanvas.Title as="h2" id="sheet-title" className="h5 mb-0">{title}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>{children}</Offcanvas.Body>
      {footer && <div className="p-3 border-top">{footer}</div>}
    </Offcanvas>
  )
}

export function Chip({ active, as: As = 'button', children, ...rest }) {
  const props = As === 'button' ? { type: 'button', 'aria-pressed': !!active } : {}
  return <As className={`vt-chip ${active ? 'active' : ''}`} {...props} {...rest}>{children}</As>
}
