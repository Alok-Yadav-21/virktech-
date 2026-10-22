import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { WORKSPACE } from '../../constants'

// Thumb-reach navigation for phones. Repair is the raised centre action because it is the shop's main job.
export default function TabBar({ items }) {
  const { count } = useCart()
  const [bump, setBump] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!count) return undefined
    setBump(true)
    const t = setTimeout(() => setBump(false), 400)
    return () => clearTimeout(t)
  }, [count])

  return (
    <nav className="vt-tabbar" aria-label="Main">
      {items.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `vt-tab ${t.primary ? 'vt-tab--primary' : ''} ${isActive || t.match?.some((m) => pathname === m || pathname.startsWith(`${m}/`)) ? 'active' : ''}`}>
          {t.primary
            ? <span className="vt-tab-disc"><Icon name={t.icon} size={24} /></span>
            : <Icon name={t.icon} size={24} />}
          <span>{t.label}</span>
          {t.badge === 'cart' && count > 0 && <span className={`vt-count ${bump ? 'vt-bump' : ''}`} aria-label={`${count} in basket`}>{count}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

// The public (shopping) tabs. Account goes to the right workspace once logged in.
export function usePublicTabs() {
  const { user } = useAuth()
  return [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/shop', label: 'Shop', icon: 'bag' },
    { to: '/app/book', label: 'Repair', icon: 'wrench', primary: true },
    { to: '/cart', label: 'Basket', icon: 'cart', badge: 'cart' },
    { to: user ? WORKSPACE[user.role].home : '/login', label: user ? 'Account' : 'Log in', icon: 'user' },
  ]
}
