import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/ui/Icon'
import { gbp } from '../../format'
import { LOYALTY } from '../../constants'

function Row({ to, icon, label, hint, onClick }) {
  const body = (
    <>
      <span className="vt-row-icon"><Icon name={icon} size={22} /></span>
      <span className="vt-row-main"><strong>{label}</strong>{hint && <span className="small text-secondary">{hint}</span>}</span>
      <Icon name="right" size={18} className="flex-none text-secondary" />
    </>
  )
  return to
    ? <Link to={to} className="vt-row text-body text-decoration-none">{body}</Link>
    : <button type="button" className="vt-row text-body w-100 bg-transparent border-0 text-start" onClick={onClick}>{body}</button>
}

// The "Me" tab: everything that is about you rather than a job in progress.
export default function Me() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => { await logout(); navigate('/') }
  const worth = Math.floor(user.loyaltyPoints / LOYALTY.STEP_POINTS) * LOYALTY.STEP_VALUE

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <span className="d-grid rounded-circle flex-none fw-bold" style={{ placeItems: 'center', width: 56, height: 56, background: 'var(--vt-green-600)', color: '#fff', fontSize: '1.4rem' }} aria-hidden="true">{user.name.trim()[0]?.toUpperCase()}</span>
        <div className="min-w-0"><h1 className="h4 mb-0 text-truncate">{user.name}</h1><p className="text-secondary mb-0 text-truncate">{user.email}</p></div>
      </div>
      <div className="vt-card mb-3" style={{ overflow: 'hidden' }}>
        <div className="list-group list-group-flush">
          <Row to="/app/loyalty" icon="gift" label="Rewards" hint={`${user.loyaltyPoints} points${worth ? `, worth ${gbp(worth)}` : ''}`} />
          <Row to="/app/sell" icon="swap" label="Sell a device" hint="Get an offer for old devices" />
          <Row to="/app/tradeins" icon="box" label="My trade-ins" />
          <Row to="/app/vape-orders" icon="receipt" label="My vape orders" hint="18+ range" />
          <Row to="/app/profile" icon="user" label="Profile and password" />
        </div>
      </div>
      <div className="vt-card mb-3" style={{ overflow: 'hidden' }}>
        <div className="list-group list-group-flush">
          <Row to="/shop" icon="bag" label="Shop" />
          <Row to="/branches" icon="pin" label="Find a branch" />
          <Row onClick={signOut} icon="logout" label="Log out" />
        </div>
      </div>
    </>
  )
}
