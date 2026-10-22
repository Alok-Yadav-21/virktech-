import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import useFetch from '../hooks/useFetch'
import { useAuth } from '../context/AuthContext'

// Stock is counted per branch. Staff see their own branch; admin chooses one.
export default function Stock() {
  const { user } = useAuth()
  const admin = user.role === 'admin'
  const { data: branches } = useFetch(admin ? '/branches' : null) // staff work on their own branch
  const [branchId, setBranchId] = useState('')
  const url = admin ? (branchId ? `/stock?branchId=${branchId}` : null) : '/stock'

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h3 className="mb-0">Stock</h3>
        {admin && (
          <select className="form-select w-auto" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Choose a branch…</option>
            {branches?.map((b) => <option key={b.id} value={b.id}>{b.area}</option>)}
          </select>
        )}
      </div>
      {url ? <StockTable key={url} url={url} branchId={admin ? Number(branchId) : undefined} /> : <p className="text-muted">Choose a branch to see its stock.</p>}
    </>
  )
}

function StockTable({ url, branchId }) {
  const { data, loading, error } = useFetch(url)
  if (loading) return <div className="spinner-border" />
  if (error) return <div className="alert alert-danger">Could not load stock.</div>
  return (
    <div className="table-responsive">
      <table className="table align-middle">
        <thead><tr><th>Product</th><th>Condition</th><th style={{ width: 220 }}>Counted stock</th></tr></thead>
        <tbody>{data.map((p) => <Row key={p.productId} p={p} branchId={branchId} />)}</tbody>
      </table>
    </div>
  )
}

function Row({ p, branchId }) {
  const [saved, setSaved] = useState(p.stock)
  const [value, setValue] = useState(p.stock)
  const save = async () => {
    try {
      const { data } = await api.patch(`/stock/${p.productId}`, { stock: Number(value), ...(branchId && { branchId }) })
      setSaved(data.stock)
      toast.success(`${p.name}: stock set to ${data.stock}`)
    } catch { /* toasted by api.js */ }
  }
  return (
    <tr>
      <td>{p.name}</td>
      <td>{p.condition}</td>
      <td>
        <div className="input-group input-group-sm">
          <input type="number" min="0" step="1" className="form-control" aria-label={`Stock for ${p.name}`} value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-outline-primary" disabled={Number(value) === saved || value === ''} onClick={save}>Save</button>
        </div>
      </td>
    </tr>
  )
}
