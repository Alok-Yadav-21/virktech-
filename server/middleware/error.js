export const notFound = (req, res) => res.status(404).json({ message: 'Not found' })

// Postgres codes that mean "the caller sent something the DB refuses", not a server fault.
const PG = {
  '23502': [400, 'A required field is missing'],
  '23514': [400, 'A value is out of range'],
  '22P02': [400, 'A value has the wrong format'],
  '22003': [400, 'A number is out of range'],
  '23503': [409, 'Cannot delete: it is still in use, or the linked record does not exist'],
  '23505': [409, 'That value already exists'],
}

// Every error leaves as { message } so the client toast has one shape to read.
export const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'That request is too large' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON' })
  const [pgStatus, pgMessage] = PG[err.code] || []
  const status = err.status || pgStatus || 500
  if (status === 500 && process.env.NODE_ENV !== 'test') {
    console.error(JSON.stringify({ level: 'error', msg: err.message, code: err.code, method: req.method, path: req.originalUrl.split('?')[0], user: req.user?.id, stack: err.stack?.split('\n').slice(0, 4) }))
  }
  res.status(status).json({ message: status === 500 ? 'Server error' : err.status ? err.message : pgMessage })
}
