import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../api'
import useFetch from '../../hooks/useFetch'
import useDebounce from '../../hooks/useDebounce'
import ListFilters from '../../components/ListFilters'
import DataTable from '../../components/DataTable'
import FormModal from '../../components/FormModal'

// One admin list+form page, driven by a config (see catalogueConfig.jsx).
export default function CrudPage({ title, url, query, noun, columns, fields, defaults, deleteVerb = 'Delete', searchable = false }) {
  const [q, setQ] = useState('')
  const search = useDebounce(q.trim())
  const listUrl = `${url}?${query ? `${query}&` : ''}all=1${searchable ? `&limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}` : ''}`
  const { data, total, loading, error, reload } = useFetch(listUrl)
  const [editing, setEditing] = useState(null) // null = closed, {} = new, row = edit
  const [lookups, setLookups] = useState({})

  // Select fields can pull their options from another endpoint (e.g. product -> categories).
  useEffect(() => {
    fields.filter((f) => f.optionsFrom).forEach((f) =>
      api.get(f.optionsFrom).then((r) => setLookups((s) => ({ ...s, [f.name]: r.data.map((o) => ({ value: o.id, label: o[f.optionLabel || 'name'] })) }))))
  }, [fields])

  const save = async (values) => {
    if (editing.id) await api.put(`${url}/${editing.id}`, values)
    else await api.post(url, values)
    toast.success(`${noun} saved`)
    setEditing(null)
    reload()
  }

  const remove = async (row) => {
    if (!window.confirm(`${deleteVerb} this ${noun.toLowerCase()}?`)) return
    try {
      await api.delete(`${url}/${row.id}`)
      toast.success(`${noun} ${deleteVerb === 'Delete' ? 'removed' : 'deactivated'}`)
      reload()
    } catch { /* api.js already toasted why (e.g. still in use) */ }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">{title}</h3>
        <button className="btn btn-primary" onClick={() => setEditing({})}>Add {noun.toLowerCase()}</button>
      </div>
      {searchable && <ListFilters q={q} onQ={setQ} shown={data?.length ?? 0} total={total} placeholder={`Search ${title.toLowerCase()} by name, email or phone`} />}
      {loading && !data && <div className="spinner-border" />}
      {error && <div className="alert alert-danger">Could not load {title.toLowerCase()}.</div>}
      {data && <DataTable columns={columns} rows={data} onEdit={setEditing} onDelete={remove} deleteLabel={deleteVerb} />}
      {editing && (
        <FormModal
          key={editing.id ?? 'new'}
          title={`${editing.id ? 'Edit' : 'Add'} ${noun.toLowerCase()}`}
          fields={fields.map((f) => (f.optionsFrom ? { ...f, options: lookups[f.name] } : f))}
          initial={editing.id ? editing : defaults}
          onSubmit={save}
          onHide={() => setEditing(null)}
        />
      )}
    </>
  )
}
