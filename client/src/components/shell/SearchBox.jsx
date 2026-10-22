import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../ui/Icon'

// Search is the front door of the shop (Amazon habit): always one tap away, goes straight to results.
export default function SearchBox({ className = '' }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const current = pathname === '/shop' ? params.get('q') || '' : ''
  const [q, setQ] = useState(current)
  useEffect(() => setQ(current), [current])

  const submit = (e) => {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/shop?q=${encodeURIComponent(term)}` : '/shop')
  }

  return (
    <form className={`vt-search ${className}`} role="search" onSubmit={submit}>
      <Icon name="search" size={20} className="vt-search-icon" />
      <input
        className="form-control" type="search" enterKeyHint="search" autoComplete="off"
        aria-label="Search the shop" placeholder="Search the shop" value={q} onChange={(e) => setQ(e.target.value)}
      />
    </form>
  )
}
