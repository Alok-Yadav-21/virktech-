import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogoMark } from '../../components/ui/Logo'
import Icon from '../../components/ui/Icon'
import TabBar from '../../components/shell/TabBar'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { WORKSPACE } from '../../constants'

// Phones get a bottom tab bar (Book is the raised centre action); desktop gets a top bar.
const TABS = [
  { to: '/app', label: 'Home', icon: 'home', end: true },
  { to: '/app/repairs', label: 'Repairs', icon: 'wrench', match: ['/app/repairs'] },
  { to: '/app/book', label: 'Book', icon: 'plus', primary: true },
  { to: '/app/orders', label: 'Orders', icon: 'receipt', match: ['/app/orders'] },
  { to: '/app/me', label: 'Me', icon: 'user', match: ['/app/me', '/app/profile', '/app/loyalty', '/app/sell', '/app/tradeins'] },
]

export default function CustomerShell() {
  const { logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const signOut = async () => { await logout(); navigate('/') }

  return (
    <div className="d-flex flex-column min-vh-100">
      <a className="vt-skip" href="#main">Skip to content</a>
      <header className="vt-header">
        <div className="container">
          <div className="vt-header-row">
            <Link to="/app" className="vt-brand" aria-label="My account home"><LogoMark size={40} /><span className="vt-desktop-only">Virktech</span></Link>
            <nav className="vt-navlinks ms-2" aria-label="My account">
              {WORKSPACE.customer.links.map((l) => <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>)}
            </nav>
            <div className="ms-auto d-flex align-items-center gap-1">
              <Link to="/shop" className="vt-icon-btn" aria-label="Shop"><Icon name="bag" /></Link>
              <Link to="/cart" className="vt-icon-btn" aria-label={`Basket, ${count} items`}>
                <Icon name="cart" />{count > 0 && <span className="vt-count" style={{ top: 2, left: 'auto', right: 0 }}>{count}</span>}
              </Link>
              <Link className="btn btn-sm btn-primary vt-desktop-only ms-2" to="/app/book">Book a repair</Link>
              <Link className="btn btn-sm btn-outline-secondary vt-desktop-only" to="/app/profile">Profile</Link>
              <button type="button" className="btn btn-sm btn-outline-secondary vt-desktop-only" onClick={signOut}>Log out</button>
            </div>
          </div>
        </div>
      </header>
      <main id="main" className="container flex-grow-1 vt-page pt-3 pt-md-4"><Outlet /></main>
      <TabBar items={TABS} />
    </div>
  )
}
