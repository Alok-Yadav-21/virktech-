// One JSON line per request: easy to read in a host's log viewer and to search. Never logs bodies or query strings.
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test' || req.path === '/api/health') return
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? 'error' : 'info',
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Number((process.hrtime.bigint() - start) / 1_000_000n),
      user: req.user?.id,
    }))
  })
  next()
}
