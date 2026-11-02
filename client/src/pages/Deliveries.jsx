import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import useFetch from '../hooks/useFetch'
import useDebounce from '../hooks/useDebounce'
import { useAuth } from '../context/AuthContext'
import ListFilters from '../components/ListFilters'
import DataTable from '../components/DataTable'
import DeliveryForm from '../components/DeliveryForm'
import { ErrorState, Skeleton } from '../components/ui/primitives'
import { gbp, plural } from '../format'

// Wholesale deliveries received. Saving one adds its pieces to the branch's stock; deleting takes them back out.
export default function Deliveries() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim())
  const { data, total, loading, error, reload } = useFetch(`/deliveries?limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}`)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, delivery = edit

  const columns = [
    { key: 'reference', label: 'Delivery', render: (d) => <>{d.reference}<span className="d-block small text-secondary">{d.supplier}</span></> },
    ...(user.role === 'admin' ? [{ key: 'branch', label: 'Branch', render: (d) => d.branch.area }] : []),
    { key: 'receivedOn', label: 'Received', render: (d) => new Date(d.receivedOn).toLocaleDateString('en-GB', { dateStyle: 'medium' }) },
    { key: 'units', label: 'Pieces', render: (d) => `${d.units} (${plural(d.lines, 'product')})` },
    { key: 'totalCost', label: 'Total cost', render: (d) => gbp(d.totalCost) },
  ]

  const open = async (row) => {
    if (!row.id) return setEditing({})
    try { setEditing((await api.get(`/deliveries/${row.id}`)).data) } catch { /* toasted by api.js */ }
  }
  const save = async (values) => {
    if (editing.id) await api.put(`/deliveries/${editing.id}`, values)
    else await api.post('/deliveries', values)
    toast.success(editing.id ? 'Delivery updated, stock adjusted' : 'Delivery recorded, stock added')
    setEditing(null)
    reload()
  }
  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.reference}? Its ${plural(row.units, 'piece')} will be taken back out of stock.`)) return
    try { await api.delete(`/deliveries/${row.id}`); toast.success('Delivery removed, stock taken back'); reload() } catch { /* toasted by api.js */ }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <h1 className="h3 mb-0">Deliveries</h1>
        <button className="btn btn-primary" onClick={() => open({})}>Record delivery</button>
      </div>
      <p className="text-secondary">What the shop bought from wholesalers. Each delivery adds to stock{user.role === 'admin' && ' and sets the buying price used in the profit report'}.</p>
      <ListFilters q={q} onQ={setQ} shown={data?.length ?? 0} total={total} placeholder="Search by supplier or reference" />
      {error && <ErrorState onRetry={reload}>We could not load deliveries.</ErrorState>}
      {loading && !data && <div className="d-grid gap-2"><Skeleton h="5rem" /><Skeleton h="5rem" /></div>}
      {data && <DataTable columns={columns} rows={data} onEdit={open} onDelete={remove} />}
      {editing && <DeliveryForm key={editing.id ?? 'new'} initial={editing} onSubmit={save} onHide={() => setEditing(null)} />}
    </>
  )
}
