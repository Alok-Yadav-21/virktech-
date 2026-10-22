// ?limit=&offset= with sane bounds. Lists send the full match count in the X-Total-Count header.
export function pageOf(req, { def = 100, max = 500 } = {}) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || def, 1), max)
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)
  return { limit, offset }
}

// Search text -> ILIKE pattern, with the wildcard characters escaped so "50%" searches for "50%".
export const likeOf = (q) => `%${String(q).trim().slice(0, 100).replace(/[\\%_]/g, '\\$&')}%`

export function sendPage(res, rows, mapRow) {
  res.set('X-Total-Count', String(rows[0]?.total_count ?? 0))
  res.json(rows.map(mapRow))
}
