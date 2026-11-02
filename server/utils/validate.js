// Shared request helpers so every route fails the same way: { message } with a real status code.
export const fail = (status, message) => Object.assign(new Error(message), { status })

// Lets async route handlers throw: errors go to the error middleware instead of crashing or hanging.
export const wrap = (fn) => (req, res, next) => fn(req, res).catch(next)

// Trimmed string with a length cap, so a client cannot store megabytes in one field.
export function str(value, { max, label, required = false }) {
  const s = typeof value === 'string' ? value.trim() : ''
  if (required && !s) throw fail(400, `${label} is required`)
  if (s.length > max) throw fail(400, `${label} must be ${max} characters or fewer`)
  return s
}

export const isEmail = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

// Optional "YYYY-MM-DD" query value: null when blank, 400 when it is not a real date.
export const asDay = (v, label) => {
  if (v == null || v === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw fail(400, `${label} must be a date like 2026-01-31`)
  return v
}
