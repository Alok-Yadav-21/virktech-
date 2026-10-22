import pool from '../db.js'
import { seedDemo } from '../seed.js'

// Runs once before all tests: rebuilds the TEST database with demo data.
// Refuses to touch any database whose name does not contain "test", so real data can never be wiped by `npm test`.
export async function setup() {
  const name = new URL(process.env.DATABASE_URL || 'postgres://x/none').pathname
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to run tests: DATABASE_URL points at "${name.slice(1)}", not a test database. Use server/.env.test (see .env.test.example).`)
  }
  await seedDemo({ force: true })
}

export async function teardown() {
  await pool.end()
}
