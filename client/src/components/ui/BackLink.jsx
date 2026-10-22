import { Link } from 'react-router-dom'
import Icon from './Icon'

export default function BackLink({ to, children }) {
  return <Link to={to} className="d-inline-flex align-items-center gap-1 text-decoration-none fw-semibold mb-2" style={{ minHeight: 44 }}><Icon name="left" size={18} />{children}</Link>
}
