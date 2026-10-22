import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import pool, { query } from './db.js'

// Deliveries add stock, cost feeds the margin report, and branch scope holds. Uses the demo users from the seed.
const PW = 'Password123!'
const as = {}
let blv, sid, product, startStock

async function login(email) {
  const agent = request.agent(app)
  expect((await agent.post('/api/auth/login').send({ email, password: PW })).status).toBe(200)
  return agent
}
const stockAt = async (branchId) => (await query('SELECT COALESCE(max(stock), 0)::int AS n FROM branch_stock WHERE branch_id = $1 AND product_id = $2', [branchId, product.id])).rows[0].n
const body = (qty, unitCost, extra = {}) => ({ supplier: 'Test Wholesale', items: [{ productId: product.id, qty, unitCost }], ...extra })

beforeAll(async () => {
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  sid = (await query("SELECT id FROM branches WHERE area = 'Sidcup'")).rows[0].id
  // A product of its own, so these tests never fight other test files over the demo products' stock.
  product = (await query("INSERT INTO products (name, category_id, price) VALUES ('Test Delivery Phone', (SELECT min(id) FROM categories), 20) RETURNING id, price")).rows[0]
  as.customer = await login('customer@demo.com')
  as.staff = await login('staff@demo.com') // Belvedere
  as.admin = await login('admin@demo.com')
  startStock = await stockAt(blv)
})

afterAll(async () => {
  await query("DELETE FROM orders WHERE reference LIKE 'TEST-MARGIN-%'")
  await query("DELETE FROM deliveries WHERE supplier = 'Test Wholesale'")
  await query('DELETE FROM branch_stock WHERE product_id = $1', [product.id])
  await query('DELETE FROM products WHERE id = $1', [product.id])
  await pool.end()
})

test('customers and strangers cannot use deliveries or margins', async () => {
  expect((await as.customer.get('/api/deliveries')).status).toBe(403)
  expect((await as.customer.get('/api/margins')).status).toBe(403)
  expect((await request(app).get('/api/deliveries')).status).toBe(401)
})

test('receiving a delivery adds stock; editing changes it by the difference; deleting takes it back', async () => {
  const made = await as.staff.post('/api/deliveries').send(body(100, 10))
  expect(made.status).toBe(201)
  expect(made.body.units).toBe(100)
  expect(made.body.totalCost).toBe(1000)
  expect(made.body.branch.id).toBe(blv)
  expect(await stockAt(blv)).toBe(startStock + 100)

  const edited = await as.staff.put(`/api/deliveries/${made.body.id}`).send(body(120, 10))
  expect(edited.status).toBe(200)
  expect(await stockAt(blv)).toBe(startStock + 120)

  expect((await as.staff.delete(`/api/deliveries/${made.body.id}`)).status).toBe(204)
  expect(await stockAt(blv)).toBe(startStock)
  expect((await as.staff.get(`/api/deliveries/${made.body.id}`)).status).toBe(404)
})

test('a delivery cannot be removed once its stock has been sold', async () => {
  const made = await as.staff.post('/api/deliveries').send(body(5, 10))
  await query('UPDATE branch_stock SET stock = 2 WHERE branch_id = $1 AND product_id = $2', [blv, product.id]) // 3 of the 5 "sold"
  const r = await as.staff.delete(`/api/deliveries/${made.body.id}`)
  expect(r.status).toBe(409)
  expect(await stockAt(blv)).toBe(2) // nothing half-done
  await query('UPDATE branch_stock SET stock = $3 WHERE branch_id = $1 AND product_id = $2', [blv, product.id, startStock + 5])
  expect((await as.staff.delete(`/api/deliveries/${made.body.id}`)).status).toBe(204)
})

test('bad input is refused with a clear message', async () => {
  expect((await as.staff.post('/api/deliveries').send({ supplier: '', items: body(1, 1).items })).status).toBe(400)
  expect((await as.staff.post('/api/deliveries').send(body(0, 10))).status).toBe(400)
  expect((await as.staff.post('/api/deliveries').send(body(1.5, 10))).status).toBe(400)
  expect((await as.staff.post('/api/deliveries').send(body(1, -1))).status).toBe(400)
  expect((await as.staff.post('/api/deliveries').send(body(1, 10, { receivedOn: '2026-02-31' }))).status).toBe(400)
  expect((await as.staff.post('/api/deliveries').send({ supplier: 'x', items: [] })).status).toBe(400)
  const dup = { supplier: 'x', items: [{ productId: product.id, qty: 1, unitCost: 1 }, { productId: product.id, qty: 1, unitCost: 1 }] }
  expect((await as.staff.post('/api/deliveries').send(dup)).status).toBe(400)
  expect((await as.staff.post('/api/deliveries').send({ ...body(1, 1), items: [{ productId: 999999, qty: 1, unitCost: 1 }] })).status).toBe(400)
})

test('staff stay in their own branch; admin names the branch', async () => {
  expect((await as.staff.post('/api/deliveries').send(body(1, 1, { branchId: sid }))).status).toBe(403)
  expect((await as.admin.post('/api/deliveries').send(body(1, 1))).status).toBe(400) // no branch chosen
  const made = await as.admin.post('/api/deliveries').send(body(7, 3, { branchId: sid }))
  expect(made.status).toBe(201)
  expect((await as.staff.get(`/api/deliveries/${made.body.id}`)).status).toBe(404) // Sidcup delivery, Belvedere staff
  expect((await as.staff.put(`/api/deliveries/${made.body.id}`).send(body(1, 1))).status).toBe(404)
  expect((await as.staff.delete(`/api/deliveries/${made.body.id}`)).status).toBe(404)
  const list = await as.staff.get('/api/deliveries')
  expect(list.body.every((d) => d.branch.id === blv)).toBe(true)
  expect((await as.admin.delete(`/api/deliveries/${made.body.id}`)).status).toBe(204)
})

test('margins show bought price, sold price and the profit between them', async () => {
  const a = await as.staff.post('/api/deliveries').send(body(100, 10))
  const b = await as.staff.post('/api/deliveries').send(body(100, 12))
  const rows = (await as.staff.get(`/api/margins?q=${encodeURIComponent((await query('SELECT name FROM products WHERE id = $1', [product.id])).rows[0].name)}`)).body
  const m = rows.find((r) => r.productId === product.id)
  expect(m.cost).toBe(11) // weighted average of 100 @ 10 and 100 @ 12
  expect(m.received).toBe(200)
  expect(m.unitProfit).toBe(Number((m.sellPrice - 11).toFixed(2)))
  const sum = (await as.admin.get('/api/margins/summary')).body
  expect(sum.stockAtCost).toBeGreaterThanOrEqual(200 * 11)

  // Two pieces sold at £20 each on a paid order: profit is 2 x (20 - 11) = £18. A cancelled order must not count.
  const { rows: [cust] } = await query("SELECT id FROM users WHERE email = 'customer@demo.com'")
  const sell = (ref, status, pay) => query(
    `INSERT INTO orders (reference, customer_id, branch_id, items, total, delivery_method, payment_method, payment_status, status, paid_at)
     VALUES ($1, $2, $3, $4, 40, 'collection', 'cash', $5, $6, CASE WHEN $5 <> 'unpaid' THEN now() END)`,
    [ref, cust.id, blv, JSON.stringify([{ productId: product.id, name: 'x', price: 20, qty: 2 }]), pay, status])
  const before = (await as.staff.get('/api/margins/summary')).body.profitToDate
  const soldBefore = m.sold
  await sell('TEST-MARGIN-1', 'collected', 'paid')
  await sell('TEST-MARGIN-2', 'cancelled', 'refunded')
  try {
    const after = (await as.staff.get('/api/margins/summary')).body
    expect(Math.round((after.profitToDate - before) * 100) / 100).toBe(18)
    const row = (await as.staff.get(`/api/margins?q=${encodeURIComponent(m.name)}`)).body.find((r) => r.productId === product.id)
    expect(row.sold - soldBefore).toBe(2)
  } finally {
    await query("DELETE FROM orders WHERE reference LIKE 'TEST-MARGIN-%'")
  }
  await as.staff.delete(`/api/deliveries/${a.body.id}`)
  await as.staff.delete(`/api/deliveries/${b.body.id}`)
})
