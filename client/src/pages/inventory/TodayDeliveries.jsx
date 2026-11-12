import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { ErrorState } from '../../components/ui/primitives'

const hhmm = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const UNDO = { electronics: '/deliveries', vape: '/vapes/deliveries' } // the existing routes; the server lets staff touch today's only

// Deliveries booked in here today, with an Undo for a mistake. Undo takes the pieces back out of stock (the server refuses
// if some were already sold and says so). Older deliveries are for admin.
export default function TodayDeliveries({ onChanged }) {
  const electronics = useFetch('/branch/deliveries?kind=electronics')
  const vapes = useFetch('/branch/deliveries?kind=vape')
  const rows = [
    ...(electronics.data || []).map((d) => ({ ...d, kind: 'electronics' })),
    ...(vapes.data || []).map((d) => ({ ...d, kind: 'vape' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const undo = async (d) => {
    if (!window.confirm(`Undo ${d.reference} from ${d.supplier}? The items will be taken back out of stock.`)) return
    try {
      await api.delete(`${UNDO[d.kind]}/${d.id}`)
      toast.success('Delivery undone')
      electronics.reload(); vapes.reload(); onChanged()
    } catch { /* api.js already toasted why */ }
  }

  return (
    <>
      <h2 className="h5 mt-5">Delivered here today</h2>
      {(electronics.error || vapes.error) && <ErrorState onRetry={() => { electronics.reload(); vapes.reload() }}>We could not load today's deliveries.</ErrorState>}
      {!rows.length && !electronics.loading && <p className="text-secondary">Nothing has been delivered today yet.</p>}
      {rows.map((d) => (
        <div key={`${d.kind}-${d.id}`} className="vt-card p-3 mb-2 d-flex flex-wrap align-items-center gap-2">
          <span className="me-auto">
            <strong>{d.supplier}</strong> <span className="text-secondary">· {d.kind === 'vape' ? 'Vapes' : 'Electronics'} · {hhmm(d.createdAt)} · {d.createdBy}</span>
            <span className="d-block small text-secondary">{d.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</span>
          </span>
          <button className="btn btn-outline-danger" onClick={() => undo(d)}>Undo</button>
        </div>
      ))}
    </>
  )
}
