import { Link } from 'react-router-dom'
import Icon from './Icon'

// A tappable list row for phones: icon, two lines of text, a status on the right and a chevron.
export default function RowCard({ to, icon, title, subtitle, meta, right }) {
  return (
    <Link to={to} className="vt-card vt-row">
      {icon && <span className="vt-row-icon"><Icon name={icon} size={22} /></span>}
      <span className="vt-row-main">
        <strong>{title}</strong>
        {subtitle && <span className="text-secondary small">{subtitle}</span>}
        {meta && <span className="text-secondary small">{meta}</span>}
        {right && <span className="mt-1">{right}</span>}
      </span>
      <span className="vt-row-end"><Icon name="right" size={18} /></span>
    </Link>
  )
}
