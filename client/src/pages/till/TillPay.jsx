import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import api from '../../api'
import { gbp } from '../../format'
import { NOTES_AND_COINS, roundUps, label as money } from './cash'

const when = (d) => new Date(d).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

// Take payment, then show a printable receipt. Cash given and change are only for the screen, never stored.
export default function TillPay({ basket, total, hasVape, onHide, onDone }) {
  const [method, setMethod] = useState('cash')
  const [given, setGiven] = useState('')
  const [idChecked, setIdChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState(null)

  // The box is text so typing "37." works; the maths below is whole pence so the buttons never drift.
  const billPence = Math.round(total * 100)
  const givenPence = Math.round(Number(given) * 100)
  const change = (givenPence - billPence) / 100
  const setPence = (p) => setGiven(String(p / 100))
  const cashShort = method === 'cash' && given !== '' && change < 0
  const blocked = busy || (hasVape && !idChecked) || cashShort

  const complete = async () => {
    setBusy(true)
    try {
      const items = basket.map((l) => ({ kind: l.kind, productId: l.id, qty: l.qty }))
      const r = await api.post('/till/sales', { items, paymentMethod: method === 'cash' ? 'cash' : 'card_in_store', idChecked })
      setReceipt(r.data)
    } catch { /* api.js already toasted why (e.g. short stock); the basket stays so staff can fix it */ } finally { setBusy(false) }
  }

  const onEnter = (e) => { if (e.key === 'Enter' && !blocked) complete() }

  if (receipt) {
    const parts = [receipt.electronics, receipt.vape].filter(Boolean)
    return (
      <Modal show onHide={onDone} centered backdrop="static">
        <Modal.Body>
          <div className="till-receipt">
            <h2 className="h5 text-center">Smart Phones Repair</h2>
            <p className="text-center small text-secondary">{when(receipt.at)} · served by {receipt.staff}</p>
            {parts.map((p) => (
              <div key={p.reference} className="mb-3">
                <div className="small text-secondary">{p.reference}</div>
                {p.lines.map((l) => (
                  <div key={l.productId} className="d-flex justify-content-between"><span>{l.qty} x {l.name}</span><span>{gbp(l.price * l.qty)}</span></div>
                ))}
              </div>
            ))}
            <div className="d-flex justify-content-between fw-bold fs-5 border-top pt-2"><span>Total</span><span>{gbp(receipt.total)}</span></div>
            <div className="d-flex justify-content-between"><span>Paid by</span><span>{receipt.paymentMethod === 'cash' ? 'Cash' : 'Card'}</span></div>
            {receipt.paymentMethod === 'cash' && given !== '' && change >= 0 && <div className="d-flex justify-content-between"><span>Change</span><span>{gbp(change) || '£0'}</span></div>}
          </div>
          <div className="d-grid gap-2 mt-3 d-print-none">
            <button className="btn btn-outline-secondary" onClick={() => window.print()}>Print receipt</button>
            <button className="btn btn-primary btn-lg" autoFocus onClick={onDone}>New sale</button>
          </div>
        </Modal.Body>
      </Modal>
    )
  }

  return (
    <Modal show onHide={onHide} size="lg" centered>
      <Modal.Header closeButton><Modal.Title>Charge {gbp(total)}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="d-flex gap-2 mb-3">
          {[['cash', 'Cash'], ['card', 'Card']].map(([k, name]) => (
            <button key={k} className={`btn btn-lg flex-fill ${method === k ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setMethod(k)}>{name}</button>
          ))}
        </div>
        {method === 'cash' && (
          <div className="mb-3">
            <label className="form-label" htmlFor="given">Cash given (£)</label>
            <input id="given" className="form-control form-control-lg" type="number" inputMode="decimal" step="0.01" min="0" autoFocus
              value={given} onChange={(e) => setGiven(e.target.value)} onKeyDown={onEnter} />
            <div className="d-flex flex-wrap gap-2 mt-2">
              <button type="button" className="btn btn-success" style={{ minHeight: 44 }} onClick={() => setPence(billPence)}>Exact</button>
              {roundUps(billPence).map((p) => (
                <button key={p} type="button" className="btn btn-outline-primary" style={{ minHeight: 44 }} onClick={() => setPence(p)}>{money(p)}</button>
              ))}
            </div>
            <div className="small text-secondary mt-3 mb-1">Add notes and coins</div>
            <div className="d-flex flex-wrap gap-2">
              {NOTES_AND_COINS.map((p) => (
                <button key={p} type="button" className="btn btn-outline-secondary" style={{ minHeight: 44, minWidth: 56 }}
                  onClick={() => setPence((given === '' ? 0 : givenPence) + p)}>+{money(p)}</button>
              ))}
              <button type="button" className="btn btn-outline-danger" style={{ minHeight: 44 }} onClick={() => setGiven('')}>Clear</button>
            </div>
            {given !== '' && <div className={`mt-3 fs-4 ${cashShort ? 'text-danger' : ''}`}>{cashShort ? `${gbp(-change)} short` : `Change: ${gbp(change) || '£0'}`}</div>}
          </div>
        )}
        {method === 'card' && <p className="text-secondary">Take the payment on the card machine first, then complete the sale.</p>}
        {hasVape && (
          <div className="form-check mb-3">
            <input id="id" type="checkbox" className="form-check-input" checked={idChecked} onChange={(e) => setIdChecked(e.target.checked)} />
            <label htmlFor="id" className="form-check-label">I checked ID: the customer is 18 or over</label>
          </div>
        )}
        <button className="btn btn-primary btn-lg w-100" disabled={blocked} onClick={complete}>{busy ? 'Saving…' : 'Complete sale'}</button>
      </Modal.Body>
    </Modal>
  )
}
