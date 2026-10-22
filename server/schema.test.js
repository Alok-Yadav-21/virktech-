import { test, expect } from 'vitest'
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
