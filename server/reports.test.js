import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import { atPinBranch } from './test/atBranch.js'
import pool, { query } from './db.js'

// Admin revenue/profit report: figures per branch and combined, kept apart per range, admin only.
const PW = 'Password123!'
const as = {}
let branch, cust, p, np, vp
const REFS = ['TEST-REP-1', 'TEST-REP-2', 'TEST-REP-3', 'TEST-REP-V', 'TEST-REP-R']

async function login(email) {
  const agent = request.agent(app)
  expect((await agent.post('/api/auth/login').send({ email, password: PW })).status).toBe(200)
  return agent
}
async function cleanup() {
  await query('DELETE FROM orders WHERE reference = ANY($1)', [REFS])
  await query('DELETE FROM vape_orders WHERE reference = ANY($1)', [REFS])
  await query('DELETE FROM repairs WHERE reference = ANY($1)', [REFS])
  await query("DELETE FROM vape_products WHERE name LIKE 'Test Rep%'")
  await query("DELETE FROM vape_brands WHERE name = 'Test Rep Brand'")
  await query("DELETE FROM products WHERE name LIKE 'Test Rep%'")
  await query("DELETE FROM branches WHERE name = 'Test Rep Branch'")
}

beforeAll(async () => {
  await cleanup()
  as.admin = await login('admin@demo.com')
  as.customer = await login('customer@demo.com')
  as.staff = request.agent(app)
  await atPinBranch('1234')
  expect((await as.staff.post('/api/auth/pin-login').send({ pin: '1234' })).status).toBe(200)
  cust = (await query("SELECT id FROM users WHERE email = 'customer@demo.com'")).rows[0].id
  // A branch of its own, so these figures cannot be disturbed by other test files.
  branch = (await query("INSERT INTO branches (name, area) VALUES ('Test Rep Branch', 'Test Rep Area') RETURNING id")).rows[0].id
  const cat = '(SELECT min(id) FROM categories)'
  p = (await query(`INSERT INTO products (name, category_id, price, cost_price) VALUES ('Test Rep Priced', ${cat}, 30, 10) RETURNING id`)).rows[0].id
  np = (await query(`INSERT INTO products (name, category_id, price, active) VALUES ('Test Rep NoCost', ${cat}, 5, false) RETURNING id`)).rows[0].id
  const brand = (await query("INSERT INTO vape_brands (name) VALUES ('Test Rep Brand') RETURNING id")).rows[0].id
  vp = (await query("INSERT INTO vape_products (brand_id, name, kind, flavour, nicotine_mg, size_ml, price, cost_price) VALUES ($1, 'Test Rep Vape', 'E-liquid', 'Mint', 10, 10, 20, 8) RETURNING id", [brand])).rows[0].id

  const order = (ref, status, pay, total, items) => query(
    `INSERT INTO orders (reference, customer_id, branch_id, items, total, delivery_method, payment_method, payment_status, status, paid_at)
     VALUES ($1, $2, $3, $4, $5, 'collection', 'cash', $6, $7, ${pay === 'paid' ? 'now()' : 'NULL'})`,
    [ref, cust, branch, JSON.stringify(items), total, pay, status])
  await order('TEST-REP-1', 'collected', 'paid', 60, [{ productId: p, name: 'x', price: 30, qty: 2 }]) // revenue 60, cost 20, profit 40
  await order('TEST-REP-2', 'collected', 'paid', 5, [{ productId: np, name: 'x', price: 5, qty: 1 }]) // no bought-for price: counted apart
  await order('TEST-REP-3', 'cancelled', 'paid', 999, [{ productId: p, name: 'x', price: 999, qty: 1 }]) // never counted
  await query(
    `INSERT INTO vape_orders (reference, customer_id, branch_id, items, total, payment_method, payment_status, status, age_confirmed, paid_at)
     VALUES ('TEST-REP-V', $1, $2, $3, 20, 'cash', 'paid', 'collected', true, now())`,
    [cust, branch, JSON.stringify([{ productId: vp, name: 'x', price: 20, qty: 1 }])]) // revenue 20, profit 12
  await query(
    `INSERT INTO repairs (reference, customer_id, branch_id, device_model, problem, fulfilment, status, quote, payment_status, paid_at, paid_amount, parts)
     VALUES ('TEST-REP-R', $1, $2, 'x', 'x', 'in_store', 'Completed', 100, 'paid', now(), 100, $3)`,
    [cust, branch, JSON.stringify([{ name: 'Screen', cost: 30 }])]) // takings 100, parts 30
})

afterAll(async () => {
  await cleanup()
  await pool.end()
})

test('admin only', async () => {
  for (const [who, status] of [['staff', 403], ['customer', 403]]) expect((await as[who].get('/api/reports')).status, who).toBe(status)
  expect((await request(app).get('/api/reports')).status).toBe(401)
  expect((await as.admin.get('/api/reports')).status).toBe(200)
})

test('one branch: three separate blocks, an extra everything line, and what sold', async () => {
  const r = await as.admin.get(`/api/reports?branchId=${branch}`)
  expect(r.status).toBe(200)
  expect(r.body.branch).toMatchObject({ id: branch, area: 'Test Rep Area' })
  const b = r.body.branches[0]
  expect(b.electronics).toEqual({ orders: 2, revenue: 65, cost: 20, profit: 40, uncosted: 5 }) // cancelled order left out, no-cost sale flagged
  expect(b.vapes).toEqual({ orders: 1, revenue: 20, cost: 8, profit: 12, uncosted: 0 })
  expect(b.repairs).toEqual({ jobs: 1, takings: 100, parts: 30, profit: 70 })
  expect(b.everything).toEqual({ revenue: 185, profit: 122 })
  expect(r.body.total.electronics.profit, 'the total covers this branch').toBe(40)
  expect(r.body.sold.electronics.find((x) => x.name === 'Test Rep Priced')).toMatchObject({ units: 2, revenue: 60, profit: 40 })
  expect(r.body.sold.electronics.find((x) => x.name === 'Test Rep NoCost').profit, 'unknown cost is not guessed').toBeNull()
  expect(r.body.sold.vapes[0]).toMatchObject({ name: 'Test Rep Vape - Mint', units: 1, profit: 12 })
})

test('all branches: the total is the sum of the branch rows', async () => {
  const r = (await as.admin.get('/api/reports')).body
  expect(r.sold).toBeNull()
  expect(r.branches.find((x) => x.id === branch).electronics.profit).toBe(40)
  const sum = (f) => Math.round(r.branches.reduce((n, x) => n + f(x), 0) * 100) / 100
  expect(r.total.electronics.revenue).toBe(sum((x) => x.electronics.revenue))
  expect(r.total.vapes.profit).toBe(sum((x) => x.vapes.profit))
  expect(r.total.repairs.takings).toBe(sum((x) => x.repairs.takings))
  expect(r.total.everything.profit).toBe(sum((x) => x.everything.profit))
})

test('dates and ids are validated, and a date range narrows the figures', async () => {
  const future = (await as.admin.get(`/api/reports?branchId=${branch}&from=2999-01-01`)).body.branches[0]
  expect(future.electronics.revenue + future.vapes.revenue + future.repairs.takings).toBe(0)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  expect((await as.admin.get(`/api/reports?branchId=${branch}&from=${today}&to=${today}`)).body.branches[0].electronics.profit).toBe(40)
  expect((await as.admin.get('/api/reports?from=nope')).status).toBe(400)
  expect((await as.admin.get('/api/reports?branchId=abc')).status).toBe(400)
  expect((await as.admin.get('/api/reports?branchId=999999')).status).toBe(404)
})
