// Search box + optional status filter + "showing X of Y". The server does the filtering and paging.
export default function ListFilters({ q, onQ, status, onStatus, statuses, shown, total, placeholder = 'Search' }) {
  return (
    <div className="mb-3">
      <div className="row g-2">
        <div className="col-md-5">
          <input className="form-control" type="search" placeholder={placeholder} value={q} onChange={(e) => onQ(e.target.value)} />
        </div>
        {statuses && (
          <div className="col-md-3">
            <select className="form-select" value={status} onChange={(e) => onStatus(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        )}
      </div>
      {total != null && total > shown && (
        <div className="small text-muted mt-2">Showing the latest {shown} of {total}. Search or filter to narrow it down.</div>
      )}
    </div>
  )
}
