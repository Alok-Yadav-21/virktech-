import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../api'
import Icon from '../../components/ui/Icon'
import { gbp, plural } from '../../format'

const money = (n) => Math.round(n * 100) / 100

// One row of "your list": name, how many, and (for a delivery) what was paid for ONE. Big buttons so it is easy to tap.
function Row({ line, delivery, showMissing, patch, remove }) {
  const set = (qty) => patch(line.id, { qty: Math.max(1, Math.min(100000, qty)) })
  const missing = delivery && (line.cost === '' || !(Number(line.cost) >= 0))
  return (
    <div className="py-3 border-bottom">
      <div className="d-flex align-items-center gap-2">
        <strong className="me-auto lh-sm">{line.name}{line.detail && <span className="d-block small text-secondary fw-normal">{line.detail}</span>}</strong>
        <button type="button" className="btn btn-outline-secondary btn-lg px-3" aria-label="One fewer" onClick={() => set(line.qty - 1)}><Icon name="minus" size={20} /></button>
        <input className="form-control form-control-lg text-center px-1" style={{ width: '4.5rem' }} type="number" inputMode="numeric" min="1" aria-label={`How many ${line.name}`}
          value={line.qty} onChange={(e) => set(parseInt(e.target.value, 10) || 1)} />
        <button type="button" className="btn btn-outline-secondary btn-lg px-3" aria-label="One more" onClick={() => set(line.qty + 1)}><Icon name="plus" size={20} /></button>
        <button type="button" className="btn btn-outline-danger btn-lg px-3" aria-label={`Remove ${line.name}`} onClick={() => remove(line.id)}><Icon name="trash" size={20} /></button>
      </div>
      {delivery && (
        <div className="mt-2">
          <label className="form-label mb-1" htmlFor={`cost-${line.id}`}>Price you paid for <strong>one</strong></label>
          <div className="input-group input-group-lg" style={{ maxWidth: '14rem' }}>
            <span className="input-group-text">£</span>
            <input id={`cost-${line.id}`} className={`form-control ${showMissing && missing ? 'is-invalid' : ''}`} type="number" inputMode="decimal" min="0" step="0.01"
              value={line.cost} onChange={(e) => patch(line.id, { cost: e.target.value })} />
          </div>
          {showMissing && missing && <div className="text-danger small mt-1">Type the price for this item.</div>}
        </div>
      )}
    </div>
  )
}

// The list being built plus the one big save button. Stock mode adds the pieces; delivery mode also records the supplier and prices.
export default function ListBar({ mode, kind, lines, patch, remove, onSaved }) {
  const delivery = mode === 'delivery'
  const [supplier, setSupplier] = useState(() => sessionStorage.getItem('stock-supplier') || '') // same supplier all morning
  const [tried, setTried] = useState(false) // show what is missing only after a failed save, not while typing
  const [busy, setBusy] = useState(false)
  if (!lines.length) return null
  const units = lines.reduce((n, l) => n + l.qty, 0)
  const total = money(lines.reduce((n, l) => n + l.qty * (Number(l.cost) || 0), 0))

  const save = async () => {
    setTried(true)
    if (delivery && (!supplier.trim() || lines.some((l) => l.cost === '' || !(Number(l.cost) >= 0)))) return toast.error('Please fill in the supplier and every price')
    setBusy(true)
    try {
      if (delivery) {
        await api.post('/branch/deliveries', { kind, supplier: supplier.trim(), items: lines.map((l) => ({ productId: l.id, qty: l.qty, unitCost: Number(l.cost) })) })
      } else {
        await api.post('/branch/stock/add', { kind, items: lines.map((l) => ({ productId: l.id, qty: l.qty })) })
      }
      onSaved(`${plural(units, 'piece')} added to your stock`)
    } catch { /* api.js already toasted why; the list stays so nothing is lost */ } finally { setBusy(false) }
  }

  return (
    <div className="vt-card p-3 mt-4 border border-success border-2">
      <h2 className="h5 mb-0">Your list</h2>
      {delivery && (
        <div className="py-3 border-bottom">
          <label className="form-label mb-1" htmlFor="stock-supplier">Who is it from? (supplier)</label>
          <input id="stock-supplier" className={`form-control form-control-lg ${tried && !supplier.trim() ? 'is-invalid' : ''}`} maxLength={120} placeholder="e.g. Mobile Wholesale Ltd"
            value={supplier} onChange={(e) => { setSupplier(e.target.value); sessionStorage.setItem('stock-supplier', e.target.value) }} />
          {tried && !supplier.trim() && <div className="text-danger small mt-1">Type the supplier's name.</div>}
        </div>
      )}
      {lines.map((l) => <Row key={l.id} line={l} delivery={delivery} showMissing={tried} patch={patch} remove={remove} />)}
      <p className="mt-3 mb-2 fs-5">{plural(units, 'piece')}{delivery && <> · total <strong>{gbp(total) || '£0'}</strong></>}</p>
      <div className="d-grid"><button type="button" className="btn btn-success btn-lg py-3 fs-5" disabled={busy} onClick={save}>{delivery ? 'Save delivery' : 'Add to stock'}</button></div>
    </div>
  )
}
