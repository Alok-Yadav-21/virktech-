import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Logo, { LogoMark } from '../components/ui/Logo'
import Icon from '../components/ui/Icon'
import SearchBox from '../components/shell/SearchBox'
import TabBar, { usePublicTabs } from '../components/shell/TabBar'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useBranch } from '../context/BranchContext'
import { WORKSPACE } from '../constants'

const LINKS = [
  ['/shop', 'Shop'],
  ['/services', 'Repairs'],
  ['/app/sell', 'Sell a device'],
  ['/branches', 'Branches'],
]

export default function PublicLayout() {
  const { user } = useAuth()
  const { count } = useCart()
  const { branch, openPicker } = useBranch()
  const tabs = usePublicTabs()
  const { pathname } = useLocation()
  const bleed = pathname === '/' // the home page lays out its own full-width sections

  return (
    <div className="d-flex flex-column min-vh-100">
      <a className="vt-skip" href="#main">Skip to content</a>
      <header className="vt-header">
        <div className="container">
          <div className="vt-header-row">
            <Link to="/" className="vt-brand" aria-label="Virktech home">
              <span className="vt-mobile-only"><LogoMark size={40} /></span>
              <span className="vt-desktop-only align-items-center gap-2"><Logo subtitle /></span>
            </Link>
            <nav className="vt-navlinks ms-2" aria-label="Sections">
              {LINKS.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
            </nav>
            <SearchBox />
            <button type="button" className="vt-icon-btn" onClick={openPicker} aria-label={branch ? `Collecting from ${branch.area}. Change branch` : 'Choose your branch'}>
              <Icon name="pin" />
            </button>
            <Link to="/cart" className="vt-icon-btn vt-desktop-only" aria-label={`Basket, ${count} items`}>
              <Icon name="cart" />{count > 0 && <span className="vt-count" style={{ top: 2, left: 'auto', right: 0 }}>{count}</span>}
            </Link>
            <Link className="btn btn-sm btn-outline-secondary vt-desktop-only" to={user ? WORKSPACE[user.role].home : '/login'}>
              {user ? 'My account' : 'Log in'}
            </Link>
            <Link className="btn btn-sm btn-primary vt-desktop-only" to="/app/book">Book a repair</Link>
          </div>
        </div>
      </header>

      <main id="main" className={`flex-grow-1 vt-page ${bleed ? '' : 'container pt-3 pt-md-4'}`}><Outlet /></main>

      <footer className="text-white" style={{ background: 'var(--vt-green-900)' }}>
        <div className="container py-5 vt-footer-pad">
          <div className="row g-4">
            <div className="col-md-5">
              <div className="vt-brand mb-3" style={{ color: '#fff' }}><Logo inverted subtitle /></div>
              <p className="mb-0" style={{ color: 'rgb(255 255 255 / 0.82)', maxWidth: '34ch' }}>
                Repairs, devices and trade-ins at {branch ? 'a branch near you' : 'branches across south-east London and Kent'}.
              </p>
            </div>
            <div className="col-6 col-md-3">
              <h2 className="h6 text-white">Shop and repair</h2>
              <ul className="list-unstyled d-grid gap-2 mb-0">
                {[...LINKS, ['/vapes', 'Vapes (18+)']].map(([to, label]) => <li key={to}><Link className="vt-foot-link" to={to}>{label}</Link></li>)}
              </ul>
            </div>
            <div className="col-6 col-md-4">
              <h2 className="h6 text-white">Help</h2>
              <ul className="list-unstyled d-grid gap-2 mb-0">
                {[['/contact', 'Contact'], ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/warranty', 'Warranty']].map(([to, label]) => (
                  <li key={to}><Link className="vt-foot-link" to={to}>{label}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <p className="small mt-4 mb-0" style={{ color: 'rgb(255 255 255 / 0.7)' }}>&copy; Virktech (Smart Phones Repair)</p>
        </div>
      </footer>

      <TabBar items={tabs} />
    </div>
  )
}
