// Generic list for admin CRUD. columns: [{ key, label, render?(row) }]. A column with no label is a picture.
// Wide screens get a table; phones get one card per row (a table would scroll sideways).
export default function DataTable({ columns, rows, onEdit, onDelete, deleteLabel = 'Delete' }) {
  if (!rows.length) return <p className="text-secondary">Nothing here yet.</p>
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key])
  const media = columns.find((c) => !c.label)
  const lead = columns.find((c) => c.label)
  const facts = columns.filter((c) => c.label && c !== lead)
  const actions = (r) => (
    <>
      <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(r)}>Edit</button>
      <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(r)}>{deleteLabel}</button>
    </>
  )

  return (
    <>
      <div className="d-grid gap-2 d-md-none">
        {rows.map((r) => (
          <div key={r.id} className="vt-card p-3">
            <div className="d-flex gap-3 align-items-center mb-2">
              {media && <span className="flex-none">{cell(media, r)}</span>}
              <strong className="me-auto min-w-0">{cell(lead, r)}</strong>
            </div>
            <dl className="row small mb-3 gy-1">
              {facts.map((c) => <div key={c.key} className="col-12 d-flex justify-content-between gap-3"><dt className="fw-normal text-secondary">{c.label}</dt><dd className="mb-0 text-end">{cell(c, r)}</dd></div>)}
            </dl>
            <div className="d-flex gap-2">{actions(r)}</div>
          </div>
        ))}
      </div>
      <div className="vt-card d-none d-md-block table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th className="text-end">Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {columns.map((c) => <td key={c.key}>{cell(c, r)}</td>)}
                <td className="text-end text-nowrap"><div className="d-inline-flex gap-1">{actions(r)}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
