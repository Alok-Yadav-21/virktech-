import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import useFetch from '../hooks/useFetch'
import { useAuth } from '../context/AuthContext'
import Icon from './ui/Icon'
import { gbp, plural } from '../format'

const blank = () => ({ productId: '', qty: '', unitCost: '' })
const money = (n) => Math.round(n * 100) / 100

// Record or edit a wholesale delivery. Each line shows what you will make per piece, so the price gap is visible while typing.
// Parent sets `key` per record so state resets between Add and Edit.
export default function DeliveryForm({ initial, onSubmit, onHide }) {
  const { user } = useAuth()
  const admin = user.role === 'admin'
  const editing = !!initial?.id
  const { data: products } = useFetch('/products')
  const { data: branches } = useFetch(admin && !editing ? '/branches' : null)
  const [head, setHead] = useState({
    branchId: '', supplier: initial?.supplier ?? '', receivedOn: initial?.receivedOn ?? new Date().toISOString().slice(0, 10), note: initial?.note ?? '',
  })
  const [lines, setLines] = useState(initial?.items?.length ? initial.items.map((i) => ({ productId: i.productId, qty: i.qty, unitCost: i.unitCost })) : [blank()])
  const [busy, setBusy] = useState(false)

  const setHeadField = (k) => (e) => setHead((h) => ({ ...h, [k]: e.target.value }))
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, [k]: v } : l)))
  const priceOf = (id) => products?.find((p) => p.id === Number(id))?.price
  const taken = new Set(lines.map((l) => Number(l.productId)))
  const units = lines.reduce((n, l) => n + (Number(l.qty) || 0), 0)
  const total = money(lines.reduce((n, l) => n + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({
        ...(admin && !editing && { branchId: Number(head.branchId) }),
        supplier: head.supplier, receivedOn: head.receivedOn, note: head.note,
        items: lines.map((l) => ({ productId: Number(l.productId), qty: Number(l.qty), unitCost: Number(l.unitCost) })),
      })
    } catch { /* api.js already toasted the server message; keep the form open */ } finally { setBusy(false) }
  }

  return (
    <Modal show onHide={onHide} fullscreen="lg-down" size="xl" scrollable centered>
      {/* The form sits between modal-content and modal-body, so it must be the flex column that lets the body scroll. */}
      <form onSubmit={submit} className="d-flex flex-column overflow-hidden" style={{ minHeight: 0, flex: '1 1 auto' }}>
        <Modal.Header closeButton><Modal.Title>{editing ? `Edit ${initial.reference}` : 'Record a delivery'}</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="row g-3 mb-4">
            {admin && !editing && (
              <div className="col-12">
                <label htmlFor="d-branch" className="form-label">Branch receiving the stock</label>
                <select id="d-branch" className="form-select" required value={head.branchId} onChange={setHeadField('branchId')}>
                  <option value="">Choose a branch…</option>
                  {branches?.map((b) => <option key={b.id} value={b.id}>{b.area}</option>)}
                </select>
              </div>
            )}
            <div className="col-sm-7">
              <label htmlFor="d-supplier" className="form-label">Supplier</label>
              <input id="d-supplier" className="form-control" required maxLength={120} placeholder="e.g. Mobile Wholesale Ltd" value={head.supplier} onChange={setHeadField('supplier')} />
            </div>
            <div className="col-sm-5">
              <label htmlFor="d-date" className="form-label">Date received</label>
              <input id="d-date" type="date" className="form-control" required value={head.receivedOn} onChange={setHeadField('receivedOn')} />
            </div>
            <div className="col-12">
              <label htmlFor="d-note" className="form-label">Note (optional)</label>
              <input id="d-note" className="form-control" maxLength={500} placeholder="Invoice number, condition of the boxes…" value={head.note} onChange={setHeadField('note')} />
            </div>
          </div>

          <h3 className="h6 mb-2">Products received</h3>
          <div className="d-grid gap-3">
            {lines.map((l, i) => {
              const sell = priceOf(l.productId)
              const cost = Number(l.unitCost)
              const each = sell != null && l.unitCost !== '' ? money(sell - cost) : null
              return (
                <div key={i} className="vt-card p-3">
                  <div className="row g-2 align-items-end">
                    <div className="col-12">
                      <label htmlFor={`d-p${i}`} className="form-label">Product</label>
                      <select id={`d-p${i}`} className="form-select" required value={l.productId} onChange={(e) => setLine(i, 'productId', e.target.value)}>
                        <option value="">Choose a product…</option>
                        {products?.map((p) => <option key={p.id} value={p.id} disabled={taken.has(p.id) && Number(l.productId) !== p.id}>{p.name} ({p.condition})</option>)}
                      </select>
                    </div>
                    <div className="col-6">
                      <label htmlFor={`d-q${i}`} className="form-label">Pieces</label>
                      <input id={`d-q${i}`} type="number" inputMode="numeric" min="1" step="1" className="form-control" required value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label htmlFor={`d-c${i}`} className="form-label">Cost of one piece (£)</label>
                      <input id={`d-c${i}`} type="number" inputMode="decimal" min="0" step="0.01" className="form-control" required value={l.unitCost} onChange={(e) => setLine(i, 'unitCost', e.target.value)} />
                    </div>
                  </div>
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2 small">
                    <span className="text-secondary">
                      {sell == null ? 'Choose a product to compare prices.'
                        : <>Sells at {gbp(sell)}{admin && each != null && <> · <span className={each < 0 ? 'text-danger' : ''}>{each < 0 ? 'loss' : 'profit'} {gbp(Math.abs(each))} each</span></>}</>}
                    </span>
                    <span className="d-inline-flex align-items-center gap-2">
                      {Number(l.qty) > 0 && l.unitCost !== '' && <span>Line total {gbp(money(Number(l.qty) * cost))}</span>}
                      {lines.length > 1 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))} aria-label="Remove this product"><Icon name="trash" size={16} /></button>}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <button type="button" className="btn btn-outline-primary mt-3" onClick={() => setLines((ls) => [...ls, blank()])}><Icon name="plus" size={18} />Add another product</button>
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <span className="small text-secondary">{plural(units, 'piece')} · total cost <strong className="text-body">{gbp(total)}</strong></span>
          <span className="d-inline-flex gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onHide}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{editing ? 'Save changes' : 'Add to stock'}</button>
          </span>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
