import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import useDebounce from '../../hooks/useDebounce'
import { EmptyState } from '../../components/ui/primitives'

// An unknown code was scanned: pick the product it belongs to once, and every later scan finds it.
export default function LinkCode({ code, kind, onLinked, onHide }) {
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim())
  const { data } = useFetch(`/branch/items?limit=60&kind=${kind}${search ? `&q=${encodeURIComponent(search)}` : ''}`)
  const free = data?.filter((i) => !i.barcode) // a product that already has a code is changed by an admin, not here

  const link = async (item) => {
    try {
      onLinked((await api.post('/branch/barcode', { kind, productId: item.id, code })).data)
    } catch { /* api.js already toasted why */ }
  }

  return (
    <Modal show onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton><Modal.Title>New code: {code}</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-secondary">This code is not linked to a product yet. Choose the product it belongs to.</p>
        <input className="form-control form-control-lg mb-3" type="search" placeholder="Search products" aria-label="Search products" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
        {free && !free.length && <EmptyState icon="info" title="Nothing found">Try a different search.</EmptyState>}
        <div className="list-group">
          {free?.map((i) => (
            <button key={i.id} type="button" className="list-group-item list-group-item-action" onClick={() => link(i)}>
              <strong>{i.name}</strong>{i.detail && <span className="d-block small text-secondary">{i.detail}</span>}
            </button>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  )
}
