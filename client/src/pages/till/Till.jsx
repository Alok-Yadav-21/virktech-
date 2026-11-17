import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api, { errMsg } from '../../api'
import useFetch from '../../hooks/useFetch'
import useDebounce from '../../hooks/useDebounce'
import useIdleLogout from '../../hooks/useIdleLogout'
import { Chip, EmptyState, ErrorState } from '../../components/ui/primitives'
import PinPad from '../../components/PinPad'
import TillCrew from './TillCrew'
import TillLogin from './TillLogin'
import TillPay from './TillPay'
import TillToday from './TillToday'
import { gbp } from '../../format'

const TABS = [['', 'All'], ['electronics', 'Electronics'], ['vape', 'Vapes']]
const keyOf = (i) => `${i.kind}-${i.id}`

// The till signs in on its own (PIN, separate cookie) so nobody at the counter can reach a dashboard, hours or wages.
// "Log out" leaves the till and ends nobody's shift.
export default function Till() {
  const [me, setMe] = useState(undefined) // undefined = checking, null = nobody signed in
  const loadMe = () => api.get('/till/me', { quiet: true }).then((r) => setMe(r.data))
    .catch((e) => (e.response?.status === 401 ? setMe(null) : toast.error(errMsg(e))))
  useEffect(() => { loadMe() }, [])
  const logOut = () => api.post('/till/logout').then(() => setMe(null)).catch(() => { /* api.js already toasted */ })
  // Ends nobody's shift: it only signs this person out of the till. If the browser will not close the tab (it was not
  // opened by the till link), go to the shop instead.
  const closeTill = async () => {
    try { await api.post('/till/logout') } catch { return /* api.js already toasted; stay put */ }
    window.close()
    window.location.assign('/')
  }
  // Nobody touching the till for 3 hours: sign out so the next person at the counter has to type their own PIN.
  useIdleLogout(() => logOut().then(() => toast('Logged out after 3 hours of inactivity')), !!me, 3 * 60 * 60 * 1000)

  if (me === undefined) return <div className="text-center py-5"><div className="spinner-border" /></div>
  if (!me) return <TillLogin onSignedIn={loadMe} />
  return <Counter me={me} reloadMe={loadMe} onLogOut={logOut} onClose={closeTill} />
}

// Full-screen counter till: find an item, tap to add, charge. The basket lives in memory only, so a refresh
// can never bring back an old sale. Prices and stock are always checked again by the server.
function Counter({ me, reloadMe, onLogOut, onClose }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [basket, setBasket] = useState([])
  const [paying, setPaying] = useState(false)
  const [showToday, setShowToday] = useState(false)
  const [showCrew, setShowCrew] = useState(false)
  const search = useDebounce(q.trim())
  const crew = useFetch('/till/crew') // who is on shift, so everyone working at this till is visible
  const items = useFetch(`/till/items?limit=60&kind=${kind}${search ? `&q=${encodeURIComponent(search)}` : ''}`)

  const total = basket.reduce((n, l) => n + Math.round(l.price * 100) * l.qty, 0) / 100
  const hasVape = basket.some((l) => l.kind === 'vape')

  const add = (item) => {
    if (item.stock < 1) return
    setBasket((b) => {
      const have = b.find((l) => keyOf(l) === keyOf(item))
      if (!have) return [...b, { ...item, qty: 1 }]
      return b.map((l) => (l === have ? { ...l, qty: Math.min(l.qty + 1, l.stock) } : l))
    })
  }
  const change = (line, by) => setBasket((b) => b.flatMap((l) => {
    if (l !== line) return [l]
    const qty = Math.min(l.qty + by, l.stock)
    return qty < 1 ? [] : [{ ...l, qty }]
  }))
  // A barcode scanner types the code and presses Enter, so Enter adds the first match.
  const onEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const first = items.data?.find((i) => i.stock > 0)
    if (first && search === q.trim()) { add(first); setQ('') }
  }

  // The till already knows who this is, so the staff dashboard opens for them on the delivery tab with no second PIN.
  // A full page load so the dashboard picks up the new sign-in; the basket here is in memory, so it is not kept.
  const openStock = async () => {
    if (basket.length && !window.confirm('The basket will be cleared. Go to the dashboard?')) return
    try {
      await api.post('/till/open-dashboard')
      window.location.assign('/staff/stock?tab=delivery') // opens on Stock & deliveries
    } catch { /* api.js already toasted why */ }
  }
  const changed = () => { reloadMe(); crew.reload() }
  const working = (
    <span className="d-flex flex-wrap gap-1">
      {crew.data?.filter((c) => c.onShift).map((c) => <span key={c.id} className="badge bg-success">{c.name}</span>)}
    </span>
  )
  // Locked screen: whoever taps their PIN starts their shift; the server hands the till to them.
  const startWithPin = (pin) => api.post('/till/clock', { pin, action: 'start' }).then(changed).catch(() => { /* api.js already toasted */ })

  if (!me.onShift) {
    return (
      <div className="container py-5" style={{ maxWidth: 520 }}>
        <h1 className="h3 mb-1">Till</h1>
        <p className="text-secondary">Nobody is on shift. Tap your PIN to start yours and open the till.</p>
        <PinPad onComplete={startWithPin} />
        <div className="d-grid gap-2 mt-4">
          <button className="btn btn-outline-secondary" onClick={() => setShowCrew(true)}>Shifts</button>
          <button className="btn btn-outline-secondary" onClick={onLogOut}>Log out</button>
          <button className="btn btn-outline-secondary" onClick={onClose}>Close till</button>
        </div>
        {showCrew && <TillCrew me={me} onHide={() => setShowCrew(false)} onChanged={changed} />}
      </div>
    )
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3 mb-3">
        <h1 className="h4 mb-0">Till <small className="text-secondary fw-normal">{me.name} · {me.branchName}</small></h1>
        <span className="me-auto d-flex align-items-center gap-2"><small className="text-secondary">On shift:</small>{working}</span>
        <button className="btn btn-outline-primary" onClick={openStock}>Dashboard</button>
        <button className="btn btn-outline-secondary" onClick={() => setShowCrew(true)}>Shifts</button>
        <button className="btn btn-outline-secondary" onClick={() => setShowToday(true)}>Today</button>
        <button className="btn btn-outline-secondary" onClick={onLogOut}>Log out</button>
        <button className="btn btn-outline-danger" onClick={onClose}>Close till</button>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <input className="form-control form-control-lg mb-2" type="search" placeholder="Search or scan an item" aria-label="Search items"
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onEnter} />
          <div className="d-flex gap-2 mb-3">
            {TABS.map(([k, label]) => <Chip key={k} active={kind === k} onClick={() => setKind(k)}>{label}</Chip>)}
          </div>
          {items.error && <ErrorState onRetry={items.reload}>We could not load the items.</ErrorState>}
          {items.data && !items.data.length && <EmptyState icon="info" title="Nothing found">Try a different search.</EmptyState>}
          <div className="row g-2">
            {items.data?.map((i) => (
              <div key={keyOf(i)} className="col-6 col-md-4 col-xl-3">
                <button className="vt-card w-100 h-100 p-3 text-start border" style={{ minHeight: '6.5rem', opacity: i.stock < 1 ? 0.5 : 1 }}
                  disabled={i.stock < 1} onClick={() => add(i)}>
                  <strong className="d-block lh-sm mb-1">{i.name}</strong>
                  {i.detail && <span className="d-block small text-secondary">{i.detail}</span>}
                  {i.barcode && <span className="d-block small text-secondary font-monospace">{i.barcode}</span>}
                  <span className="d-flex justify-content-between mt-2">
                    <span className="fw-bold">{gbp(i.price)}</span>
                    <span className={`small ${i.stock < 1 ? 'text-danger' : 'text-secondary'}`}>{i.stock < 1 ? 'Out of stock' : `${i.stock} in stock`}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="col-lg-4">
          <div className="vt-card p-3 position-sticky" style={{ top: '1rem' }}>
            <h2 className="h6">Basket</h2>
            {!basket.length && <p className="text-secondary">Tap an item to add it.</p>}
            {basket.map((l) => (
              <div key={keyOf(l)} className="d-flex align-items-center gap-2 py-2 border-bottom">
                <span className="me-auto min-w-0">
                  <span className="d-block text-truncate">{l.name}</span>
                  <span className="small text-secondary">{gbp(l.price)} each</span>
                </span>
                <button className="btn btn-outline-secondary px-3" aria-label={`One fewer ${l.name}`} onClick={() => change(l, -1)}>-</button>
                <span style={{ minWidth: '1.5rem' }} className="text-center">{l.qty}</span>
                <button className="btn btn-outline-secondary px-3" aria-label={`One more ${l.name}`} disabled={l.qty >= l.stock} onClick={() => change(l, 1)}>+</button>
              </div>
            ))}
            <div className="d-flex justify-content-between align-items-center my-3">
              <span>Total</span><span className="fs-3 fw-bold">{gbp(total) || '£0'}</span>
            </div>
            <div className="d-grid gap-2">
              <button className="btn btn-primary btn-lg" disabled={!basket.length} onClick={() => setPaying(true)}>Charge</button>
              <button className="btn btn-outline-secondary" disabled={!basket.length} onClick={() => setBasket([])}>Clear</button>
            </div>
          </div>
        </div>
      </div>

      {paying && (
        <TillPay basket={basket} total={total} hasVape={hasVape} onHide={() => setPaying(false)}
          onDone={() => { setPaying(false); setBasket([]); items.reload() }} />
      )}
      {showToday && <TillToday onHide={() => setShowToday(false)} onVoided={items.reload} />}
      {showCrew && <TillCrew me={me} onHide={() => setShowCrew(false)} onChanged={changed} />}
    </div>
  )
}
