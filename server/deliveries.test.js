import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import pool, { query } from './db.js'

// Deliveries add stock, cost feeds the margin report, and branch scope holds. Uses the demo users from the seed.
const PW = 'Password123!'
const as = {}
let blv, sid, product, startStock

async function loginPin(pin) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/pin-login').send({ pin })
  expect(r.status, `pin login ${pin}`).toBe(200)
  return agent
}

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
  as.staff = await loginPin('1234') // Belvedere
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
  const rows = (await as.admin.get(`/api/margins?q=${encodeURIComponent((await query('SELECT name FROM products WHERE id = $1', [product.id])).rows[0].name)}`)).body
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
  const before = (await as.admin.get('/api/margins/summary')).body.profitToDate
  const soldBefore = m.sold
  await sell('TEST-MARGIN-1', 'collected', 'paid')
  await sell('TEST-MARGIN-2', 'cancelled', 'refunded')
  try {
    const after = (await as.admin.get('/api/margins/summary')).body
    expect(Math.round((after.profitToDate - before) * 100) / 100).toBe(18)
    const row = (await as.admin.get(`/api/margins?q=${encodeURIComponent(m.name)}`)).body.find((r) => r.productId === product.id)
    expect(row.sold - soldBefore).toBe(2)
  } finally {
    await query("DELETE FROM orders WHERE reference LIKE 'TEST-MARGIN-%'")
  }
  await as.staff.delete(`/api/deliveries/${a.body.id}`)
  await as.staff.delete(`/api/deliveries/${b.body.id}`)
})

test('profit counts every item: sales with no recorded cost and repair profit are shown, not dropped', async () => {
  const { rows: [cust] } = await query("SELECT id FROM users WHERE email = 'customer@demo.com'")
  const get = async () => (await as.admin.get('/api/margins/summary')).body
  const before = await get()
  await query(
    `INSERT INTO orders (reference, customer_id, branch_id, items, total, delivery_method, payment_method, payment_status, status, paid_at)
     VALUES ('TEST-MARGIN-3', $1, $2, $3, 40, 'collection', 'cash', 'paid', 'collected', now())`,
    [cust.id, blv, JSON.stringify([{ productId: product.id, name: 'x', price: 20, qty: 2 }])])
  await query(
    `INSERT INTO repairs (reference, customer_id, branch_id, device_model, problem, fulfilment, status, quote, payment_status, paid_at, paid_amount, parts)
     VALUES ('TEST-MARGIN-R', $1, $2, 'x', 'x', 'in_store', 'Completed', 100, 'paid', now(), 100, $3)`,
    [cust.id, blv, JSON.stringify([{ name: 'Screen', cost: 30 }])])
  try {
    const after = await get()
    expect(after.salesWithoutCost - before.salesWithoutCost).toBe(40)
    expect(after.itemsWithoutCost).toBeGreaterThan(0)
    expect(after.profitToDate, 'unknown cost is never turned into invented profit').toBe(before.profitToDate)
    expect(after.repairProfit - before.repairProfit).toBe(70)
    expect(after.repairTakings - before.repairTakings).toBe(100)
  } finally {
    await query("DELETE FROM orders WHERE reference = 'TEST-MARGIN-3'")
    await query("DELETE FROM repairs WHERE reference = 'TEST-MARGIN-R'")
  }
})

test('a "bought for" price on the product counts for profit, a delivery takes over, and customers never see it', async () => {
  const { rows: [cust] } = await query("SELECT id FROM users WHERE email = 'customer@demo.com'")
  const p = (await query("INSERT INTO products (name, category_id, price) VALUES ('Test Old Stock', (SELECT min(id) FROM categories), 30) RETURNING id, name")).rows[0]
  const sum = async () => (await as.admin.get('/api/margins/summary')).body
  const row = async () => (await as.admin.get(`/api/margins?q=${encodeURIComponent(p.name)}`)).body.find((r) => r.productId === p.id)
  await query(
    `INSERT INTO orders (reference, customer_id, branch_id, items, total, delivery_method, payment_method, payment_status, status, paid_at)
     VALUES ('TEST-MARGIN-4', $1, $2, $3, 60, 'collection', 'cash', 'paid', 'collected', now())`,
    [cust.id, blv, JSON.stringify([{ productId: p.id, name: 'x', price: 30, qty: 2 }])])
  try {
    expect((await row()).cost, 'no cost yet').toBeNull()
    const before = await sum()
    expect((await as.staff.put(`/api/products/${p.id}`).send({ costPrice: 5 })).status, 'staff cannot set it').toBe(403)
    expect((await as.admin.put(`/api/products/${p.id}`).send({ costPrice: 20 })).body.costPrice).toBe(20)
    expect((await as.admin.put(`/api/products/${p.id}`).send({ costPrice: -1 })).status, 'negative price').toBe(400)
    const after = await sum()
    expect(Math.round((after.profitToDate - before.profitToDate) * 100) / 100).toBe(20) // 2 x (30 - 20)
    expect(after.salesWithoutCost - before.salesWithoutCost).toBe(-60)
    expect((await row()).cost).toBe(20)

    const d = await as.admin.post('/api/deliveries').send({ supplier: 'T', branchId: blv, items: [{ productId: p.id, qty: 1, unitCost: 25 }] })
    expect((await row()).cost, 'a recorded delivery takes over').toBe(25)
    await as.admin.delete(`/api/deliveries/${d.body.id}`)

    expect(JSON.stringify((await request(app).get(`/api/products/${p.id}`)).body)).not.toContain('costPrice')
    expect((await request(app).get('/api/products')).body.every((x) => !('costPrice' in x))).toBe(true)
  } finally {
    await query("DELETE FROM orders WHERE reference = 'TEST-MARGIN-4'")
    await query('DELETE FROM branch_stock WHERE product_id = $1', [p.id])
    await query('DELETE FROM products WHERE id = $1', [p.id])
  }
})

test('every sold product shows in profit, missing prices can be listed, and new products need a bought-for price', async () => {
  const { rows: [cust] } = await query("SELECT id FROM users WHERE email = 'customer@demo.com'")
  const p = (await query("INSERT INTO products (name, category_id, price, active) VALUES ('Test Hidden Seller', (SELECT min(id) FROM categories), 30, false) RETURNING id, name")).rows[0]
  await query(
    `INSERT INTO orders (reference, customer_id, branch_id, items, total, delivery_method, payment_method, payment_status, status, paid_at)
     VALUES ('TEST-MARGIN-5', $1, $2, $3, 30, 'collection', 'cash', 'paid', 'collected', now())`,
    [cust.id, blv, JSON.stringify([{ productId: p.id, name: 'x', price: 30, qty: 1 }])])
  try {
    const find = async (qs = '') => (await as.admin.get(`/api/margins?q=${encodeURIComponent(p.name)}${qs}`)).body.find((r) => r.productId === p.id)
    expect((await find()).sold, 'a hidden product that sold still shows').toBe(1)
    expect((await find('&missing=1')).productId, 'and is on the missing-price list').toBe(p.id)
    await as.admin.put(`/api/products/${p.id}`).send({ costPrice: 12 })
    expect(await find('&missing=1'), 'off the list once priced').toBeUndefined()
    const row = await find()
    expect([row.cost, row.costSource, row.profitToDate]).toEqual([12, 'typed', 18])

    const base = { name: 'Test No Cost', categoryId: 1, price: 9 }
    expect((await as.admin.post('/api/products').send(base)).status, 'create without it').toBe(400)
    expect((await as.admin.post('/api/products').send({ ...base, costPrice: null })).status, 'create with blank').toBe(400)
    expect((await as.admin.put(`/api/products/${p.id}`).send({ costPrice: null })).status, 'cannot blank it').toBe(400)
  } finally {
    await query("DELETE FROM orders WHERE reference = 'TEST-MARGIN-5'")
    await query('DELETE FROM products WHERE id = $1', [p.id])
  }
})

test('staff can never see profit, in either range; admin can', async () => {
  for (const url of ['/api/margins', '/api/margins/summary', '/api/vapes/margins', '/api/vapes/margins/summary']) {
    expect((await as.staff.get(url)).status, `staff ${url}`).toBe(403)
    expect((await as.customer.get(url)).status, `customer ${url}`).toBe(403)
    expect((await request(app).get(url)).status, `anonymous ${url}`).toBe(401)
    expect((await as.admin.get(url)).status, `admin ${url}`).toBe(200)
  }
})
