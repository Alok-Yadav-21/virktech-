import { test, expect, afterAll } from 'vitest'
import pool from './db.js'
import { readdirSync, readFileSync } from 'fs'
import {
  ROLES, REPAIR_STATUSES, ORDER_STATUS, TRADEIN_STATUSES, FULFILMENT, DELIVERY_METHODS, PAYMENT_METHODS, TRADEIN_CONDITIONS,
} from './utils/rules.js'

// The database repeats the status lists as CHECK constraints. If rules.js gains a status the SQL does not know,
// every update to it would fail in production, so keep the two in step.
const sql = readdirSync(new URL('./migrations/', import.meta.url))
  .filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(new URL(`./migrations/${f}`, import.meta.url), 'utf8')).join('\n')

test('every status and option in rules.js is allowed by the schema', () => {
  const all = [...ROLES, ...REPAIR_STATUSES, ...Object.values(ORDER_STATUS), ...TRADEIN_STATUSES, ...FULFILMENT, ...DELIVERY_METHODS, ...PAYMENT_METHODS, ...TRADEIN_CONDITIONS]
  for (const value of all) expect(sql, `schema is missing '${value}'`).toContain(`'${value}'`)
})

test('migration files are numbered and in order', () => {
  const files = readdirSync(new URL('./migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort()
  files.forEach((f, i) => expect(f.startsWith(String(i + 1).padStart(3, '0') + '_'), `${f} should be number ${i + 1}`).toBe(true))
})

afterAll(() => pool.end())
test('products have valid made-up EAN-13 barcodes (500... electronics, 501... vapes)', async () => {
  const ean = (c) => { const d = [...c].map(Number); return (10 - (d.slice(0, 12).reduce((s, n, i) => s + n * (i % 2 ? 3 : 1), 0) % 10)) % 10 === d[12] }
  for (const [table, prefix] of [['products', '500'], ['vape_products', '501']]) {
    const { rows } = await pool.query(`SELECT barcode FROM ${table} WHERE barcode LIKE $1`, [`${prefix}%`])
    expect(rows.length, table).toBeGreaterThan(0)
    expect(rows.every((r) => r.barcode.length === 13 && ean(r.barcode)), table).toBe(true)
  }
})
