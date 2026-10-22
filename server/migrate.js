import { readdirSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import pool from './db.js'

const DIR = new URL('./migrations/', import.meta.url)

// Applies each migrations/NNN_name.sql once, in order, each in its own transaction.
// Safe to run on every deploy: already-applied files are skipped. Never edits existing data.
export async function runMigrations(db = pool) {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
  const done = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
  const applied = []
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(readFileSync(new URL(file, DIR), 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      applied.push(file)
    } catch (e) {
      await client.query('ROLLBACK')
      throw new Error(`Migration ${file} failed and was rolled back: ${e.message}`)
    } finally {
      client.release()
    }
  }
  return applied
}

// `npm run migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const applied = await runMigrations()
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.')
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
