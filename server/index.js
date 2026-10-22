import app from './app.js'
import pool from './db.js'
import { assertConfig, config } from './config.js'

try {
  assertConfig()
  await pool.query('SELECT 1') // fail fast if DATABASE_URL is wrong
  const { rows } = await pool.query("SELECT to_regclass('public.schema_migrations') AS t")
  if (!rows[0].t) throw new Error('The database has no tables yet. Run: npm run migrate')
} catch (e) {
  console.error(`Cannot start: ${e.message}`)
  process.exit(1)
}

const server = app.listen(config.port, () => console.log(JSON.stringify({ level: 'info', msg: `API listening on port ${config.port}`, env: config.isProd ? 'production' : 'development' })))

// Let in-flight requests finish before the host stops or restarts the process.
function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', msg: `${signal} received, shutting down` }))
  server.close(async () => { await pool.end(); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
// A bug that escapes every handler should crash loudly so the host restarts a clean process.
process.on('unhandledRejection', (err) => { console.error(JSON.stringify({ level: 'error', msg: 'unhandledRejection', error: String(err?.stack || err) })); process.exit(1) })
