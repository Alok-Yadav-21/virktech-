import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Offcanvas } from 'react-bootstrap'
import { LogoMark } from '../../components/ui/Logo'
import Icon from '../../components/ui/Icon'
import { useAuth } from '../../context/AuthContext'
import { WORKSPACE } from '../../constants'

// Staff and admin: a quiet sidebar on desktop, the same menu in a slide-out drawer on phones and tablets.
export default function StaffShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { home, links } = WORKSPACE[user.role]
  const all = [...links, { section: 'Account', to: `${home}/profile`, label: 'Profile', icon: 'user' }]
  const signOut = async () => { await logout(); navigate('/') }

  const menu = (
    <>
      <Link to={home} className="vt-brand px-2 mb-3" onClick={() => setOpen(false)}>
        <LogoMark size={36} />
        <span style={{ lineHeight: 1.1 }}>Virktech<small className="text-capitalize">{user.role}</small></span>
      </Link>
      <nav aria-label={`${user.role} menu`} className="d-grid gap-1">
        {all.map((l) => (
          <div key={l.to} className="d-grid gap-1">
            {l.section && <span className="vt-side-label">{l.section}</span>}
            <NavLink to={l.to} end={l.end} onClick={() => setOpen(false)}><Icon name={l.icon} size={20} />{l.label}</NavLink>
          </div>
        ))}
      </nav>
      <div className="mt-auto pt-3 border-top d-grid gap-1">
        <p className="small text-secondary px-2 mb-1 text-truncate">{user.name}<br />{user.email}</p>
        {user.role === 'staff' && <a href="/till" target="_blank" rel="noopener" className="d-flex"><Icon name="receipt" size={20} />Open the till</a>}
        <Link to="/" onClick={() => setOpen(false)} className="d-flex"><Icon name="bag" size={20} />View the shop</Link>
        <button type="button" className="vt-side-link" onClick={signOut}><Icon name="logout" size={20} />Log out</button>
      </div>
    </>
  )

  return (
    <div className="d-flex min-vh-100">
      <a className="vt-skip" href="#main">Skip to content</a>
      <aside className="vt-side d-none d-lg-flex">{menu}</aside>
      <div className="flex-grow-1 min-w-0" style={{ minWidth: 0 }}>
        <header className="vt-header d-lg-none">
          <div className="container">
            <div className="vt-header-row">
              <button type="button" className="vt-icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
              <Link to={home} className="vt-brand"><LogoMark size={36} />Virktech</Link>
              <span className="vt-pill vt-pill--brand ms-auto text-capitalize">{user.role}</span>
            </div>
          </div>
        </header>
        <Offcanvas show={open} onHide={() => setOpen(false)} placement="start" style={{ maxWidth: '86vw', background: '#fff' }}>
          <Offcanvas.Header closeButton><Offcanvas.Title className="visually-hidden">Menu</Offcanvas.Title></Offcanvas.Header>
          <Offcanvas.Body className="vt-side border-0 p-3 pt-0 position-static" style={{ height: 'auto', width: 'auto' }}>{menu}</Offcanvas.Body>
        </Offcanvas>
        <main id="main" className="container-xl py-3 py-lg-4 px-3 px-lg-4"><Outlet /></main>
      </div>
    </div>
  )
}
