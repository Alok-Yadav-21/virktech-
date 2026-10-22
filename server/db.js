import pg from 'pg'

// pg returns NUMERIC and COUNT (bigint) as strings; the app wants numbers.
pg.types.setTypeParser(1700, parseFloat)
pg.types.setTypeParser(20, (v) => parseInt(v, 10))

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000, // fail a request instead of hanging when the database is unreachable
})

// An idle connection dropped by the server (common with hosted databases) must not crash the process.
pool.on('error', (err) => console.error(JSON.stringify({ level: 'error', msg: 'idle database client error', error: err.message })))

export const query = (text, params) => pool.query(text, params)
export default pool

// Run several statements as one all-or-nothing unit (e.g. take stock + create order).
export async function tx(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
