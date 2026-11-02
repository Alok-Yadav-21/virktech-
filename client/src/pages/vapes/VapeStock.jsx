import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import { useAuth } from '../../context/AuthContext'
import { nicotineLabel } from '../../vapeConstants'

// Vape stock is counted per branch, apart from electronics. Staff see their own branch; admin chooses one.
export default function VapeStock() {
  const { user } = useAuth()
  const admin = user.role === 'admin'
  const { data: branches } = useFetch(admin ? '/branches' : null)
  const lowest = useFetch(admin ? '/vapes/stock/lowest-branch' : null) // admin opens on the branch that needs stock most
  const [picked, setPicked] = useState('')
  const branchId = picked || String(lowest.data?.branchId ?? '')
  const url = admin ? (branchId ? `/vapes/stock?branchId=${branchId}` : null) : '/vapes/stock'

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Vape stock</h1>
        {admin && (
          <select className="form-select w-auto" aria-label="Branch" value={branchId} onChange={(e) => setPicked(e.target.value)}>
            {branches?.map((b) => <option key={b.id} value={b.id}>{b.area}{b.id === lowest.data?.branchId ? ' (lowest stock)' : ''}</option>)}
          </select>
        )}
      </div>
      {url ? <StockTable key={url} url={url} branchId={admin ? Number(branchId) : undefined} /> : <div className="spinner-border" />}
    </>
  )
}

function StockTable({ url, branchId }) {
  const { data, loading, error } = useFetch(url)
  if (loading) return <div className="spinner-border" />
  if (error) return <div className="alert alert-danger">Could not load stock.</div>
  if (!data.length) return <p className="text-secondary">No vape products yet. An admin adds them under Vape products.</p>
  return (
    <div className="table-responsive">
      <table className="table align-middle">
        <thead><tr><th>Product</th><th>Strength</th><th style={{ width: 220 }}>Counted stock</th></tr></thead>
        <tbody>{data.map((p) => <Row key={p.productId} p={p} branchId={branchId} />)}</tbody>
      </table>
    </div>
  )
}

function Row({ p, branchId }) {
  const [saved, setSaved] = useState(p.stock)
  const [value, setValue] = useState(p.stock)
  const label = `${p.brand} ${p.name}${p.flavour ? ` (${p.flavour})` : ''}`
  const save = async () => {
    try {
      const { data } = await api.patch(`/vapes/stock/${p.productId}`, { stock: Number(value), ...(branchId && { branchId }) })
      setSaved(data.stock)
      toast.success(`${label}: stock set to ${data.stock}`)
    } catch { /* toasted by api.js */ }
  }
  return (
    <tr>
      <td>{label}<span className="d-block small text-secondary">{p.kind}</span></td>
      <td>{nicotineLabel(p.nicotineMg)}</td>
      <td>
        <div className="input-group input-group-sm">
          <input type="number" min="0" step="1" className="form-control" aria-label={`Stock for ${label}`} value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-outline-primary" disabled={Number(value) === saved || value === ''} onClick={save}>Save</button>
        </div>
      </td>
    </tr>
  )
}
