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
