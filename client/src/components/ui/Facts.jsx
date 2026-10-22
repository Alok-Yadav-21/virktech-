// Label on the left, value on the right: the plain way to show a record's details on a phone.
export default function Facts({ items }) {
  return (
    <dl className="row mb-0 gy-2">
      {items.filter(Boolean).map(([k, v]) => (
        <div key={k} className="col-12 d-flex justify-content-between gap-3"><dt className="fw-normal text-secondary">{k}</dt><dd className="mb-0 text-end fw-semibold">{v}</dd></div>
      ))}
    </dl>
  )
}
