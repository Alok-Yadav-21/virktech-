import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import { atPinBranch } from './test/atBranch.js'
import pool, { query } from './db.js'

// The vape range end to end: catalogue CRUD, deliveries add stock, 18+ orders, scope, and profit kept apart
// from electronics. Uses the demo users from the seed and a brand and product of its own.
const PW = 'Password123!'
const as = {}
let blv, sid, brand, product, profitBefore, revenueBefore

async function loginPin(pin) {
  const agent = request.agent(app)
  await atPinBranch(pin)
  const r = await agent.post('/api/auth/pin-login').send({ pin })
  expect(r.status, `pin login ${pin}`).toBe(200)
  return agent
}

async function login(email) {
  const agent = request.agent(app)
  expect((await agent.post('/api/auth/login').send({ email, password: PW })).status).toBe(200)
  return agent
}
const stockAt = async (branchId) => (await query('SELECT COALESCE(max(stock), 0)::int AS n FROM vape_stock WHERE branch_id = $1 AND product_id = $2', [branchId, product.id])).rows[0].n
const order = (agent, qty = 2, extra = {}) => agent.post('/api/vapes/orders').send({
  items: [{ productId: product.id, qty }], branchId: blv, paymentMethod: 'cash', ageConfirmed: true, ...extra,
})

beforeAll(async () => {
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  sid = (await query("SELECT id FROM branches WHERE area = 'Sidcup'")).rows[0].id
  as.customer = await login('customer@demo.com')
  as.staff = await loginPin('123456') // Belvedere
  as.admin = await login('admin@demo.com')
  profitBefore = (await as.admin.get('/api/vapes/margins/summary')).body.profitToDate
  revenueBefore = (await as.admin.get('/api/vapes/dashboard')).body.revenueLast30Days
})

afterAll(async () => {
  await query("DELETE FROM vape_orders WHERE items::text LIKE '%Test Vape%'")
  await query("DELETE FROM vape_deliveries WHERE supplier = 'Test Vape Wholesale'")
  if (product) { await query('DELETE FROM vape_stock WHERE product_id = $1', [product.id]); await query('DELETE FROM vape_products WHERE id = $1', [product.id]) }
  await query("DELETE FROM vape_brands WHERE name = 'Test Vape Brand'")
  await pool.end()
})

test('only admin can manage the catalogue; the public sees active products only', async () => {
  expect((await as.staff.post('/api/vapes/brands').send({ name: 'Nope' })).status).toBe(403)
  expect((await as.customer.post('/api/vapes/brands').send({ name: 'Nope' })).status).toBe(403)
  const b = await as.admin.post('/api/vapes/brands').send({ name: 'Test Vape Brand', active: true })
  expect(b.status).toBe(201)
  brand = b.body
  const p = await as.admin.post('/api/vapes/products').send({
    name: 'Test Vape Mango Ice', brandId: brand.id, kind: 'E-liquid', flavour: 'Mango ice', flavourGroup: 'Fruit', nicotineMg: 10, sizeMl: 10, price: 20, costPrice: 8, active: true,
  })
  expect((await as.admin.post('/api/vapes/products').send({ name: 'Test Vape No Cost', brandId: brand.id, kind: 'E-liquid', nicotineMg: 10, price: 5 })).status, 'bought-for is required').toBe(400)
  expect(p.status).toBe(201)
  product = p.body
  expect(product.brand).toBe('Test Vape Brand')
  expect(product.stockTotal).toBe(0)
  const pub = await request(app).get('/api/vapes/products')
  expect(pub.status).toBe(200)
  expect(pub.body.some((x) => x.id === product.id)).toBe(true)
  expect((await request(app).get('/api/vapes/products?all=1')).status).toBe(401)
})

test('the schema refuses a nicotine strength above the UK limit and unknown kinds', async () => {
  const base = { name: 'Test Vape Bad', brandId: brand.id, price: 5, costPrice: 2 }
  expect((await as.admin.post('/api/vapes/products').send({ ...base, kind: 'E-liquid', nicotineMg: 21 })).status).toBe(400)
  expect((await as.admin.post('/api/vapes/products').send({ ...base, kind: 'Disposable', nicotineMg: 0 })).status).toBe(400)
})

test('vape deliveries add stock and are scoped to the branch', async () => {
  const body = { supplier: 'Test Vape Wholesale', items: [{ productId: product.id, qty: 50, unitCost: 8 }] }
  expect((await as.customer.get('/api/vapes/deliveries')).status).toBe(403)
  const made = await as.staff.post('/api/vapes/deliveries').send(body)
  expect(made.status).toBe(201)
  expect(made.body.reference).toMatch(/^VP-DEL-/)
  expect(made.body.totalCost).toBe(400)
  expect(await stockAt(blv)).toBe(50)
  expect((await as.staff.post('/api/vapes/deliveries').send({ ...body, branchId: sid })).status).toBe(403)
  const other = await as.admin.post('/api/vapes/deliveries').send({ ...body, branchId: sid })
  expect(other.status).toBe(201)
  expect((await as.staff.get(`/api/vapes/deliveries/${other.body.id}`)).status).toBe(404)
  expect((await as.admin.delete(`/api/vapes/deliveries/${other.body.id}`)).status).toBe(204)
  expect(await stockAt(sid)).toBe(0)
})

test('electronics stock and orders are untouched by vapes', async () => {
  const before = (await query('SELECT count(*)::int AS n FROM orders')).rows[0].n
  await order(as.customer, 1)
  expect((await query('SELECT count(*)::int AS n FROM orders')).rows[0].n).toBe(before)
  await query("DELETE FROM vape_orders WHERE items::text LIKE '%Test Vape%'")
  await query('UPDATE vape_stock SET stock = 50 WHERE product_id = $1 AND branch_id = $2', [product.id, blv])
})

test('an order needs the 18+ confirmation, takes stock, and cancelling gives it back', async () => {
  expect((await order(as.customer, 2, { ageConfirmed: false })).status).toBe(400)
  expect((await order(as.customer, 2, { ageConfirmed: 'yes' })).status).toBe(400)
  expect((await order(as.staff)).status).toBe(403) // customers only
  expect((await order(as.customer, 51)).status).toBe(400) // over the per-line limit
  expect((await order(as.customer, 20, { branchId: sid })).status).toBe(409) // none at Sidcup
  const made = await order(as.customer, 2)
  expect(made.status).toBe(201)
  expect(made.body.reference).toMatch(/^VP-ORD-/)
  expect(made.body.total).toBe(40)
  expect(made.body.customer).toBeUndefined() // customers do not get the customer block
  expect(await stockAt(blv)).toBe(48)
  const cancelled = await as.customer.post(`/api/vapes/orders/${made.body.reference}/cancel`)
  expect(cancelled.status).toBe(200)
  expect(cancelled.body.status).toBe('cancelled')
  expect(await stockAt(blv)).toBe(50)
})

test('staff move an order along; collecting needs payment; scope holds', async () => {
  const made = (await order(as.customer, 3)).body
  const ref = made.reference
  expect((await as.customer.patch(`/api/vapes/orders/${ref}/status`).send({ status: 'ready' })).status).toBe(403)
  expect((await as.staff.patch(`/api/vapes/orders/${ref}/status`).send({ status: 'collected' })).status).toBe(400)
  expect((await as.staff.patch(`/api/vapes/orders/${ref}/status`).send({ status: 'ready' })).body.status).toBe('ready')
  expect((await as.staff.patch(`/api/vapes/orders/${ref}/status`).send({ status: 'collected' })).status).toBe(400) // unpaid
  expect((await as.staff.patch(`/api/vapes/orders/${ref}/pay`)).body.paymentStatus).toBe('paid')
  const done = await as.staff.patch(`/api/vapes/orders/${ref}/status`).send({ status: 'collected' })
  expect(done.body.status).toBe('collected')
  expect(done.body.customer.email).toBe('customer@demo.com')
  expect((await as.customer.post(`/api/vapes/orders/${ref}/cancel`)).status).toBe(400)
  // a stranger and other-branch staff cannot see it
  const other = (await as.admin.post('/api/vapes/deliveries').send({ supplier: 'Test Vape Wholesale', branchId: sid, items: [{ productId: product.id, qty: 5, unitCost: 8 }] })).body
  const theirs = await order(as.customer, 1, { branchId: sid })
  expect((await as.staff.get(`/api/vapes/orders/${theirs.body.reference}`)).status).toBe(404)
  expect((await as.staff.get('/api/vapes/orders?limit=100')).body.every((o) => o.branch.id === blv)).toBe(true)
  await as.admin.patch(`/api/vapes/orders/${theirs.body.reference}/status`).send({ status: 'ready' })
  await as.admin.post(`/api/vapes/orders/${theirs.body.reference}/cancel`)
  expect(other.id).toBeTruthy()
})

test('vape profit is its own report: 3 sold at £20 that cost £8 = £36', async () => {
  const sum = (await as.admin.get('/api/vapes/margins/summary')).body
  expect(Math.round((sum.profitToDate - profitBefore) * 100) / 100).toBe(36) // the seed also has demo sales
  const row = (await as.admin.get('/api/vapes/margins?q=Mango')).body.find((r) => r.productId === product.id)
  expect(row.cost).toBe(8)
  expect(row.unitProfit).toBe(12)
  expect(row.marginPct).toBe(60)
  expect(row.sold).toBe(3)
  const dash = (await as.admin.get('/api/vapes/dashboard')).body
  expect((await as.staff.get('/api/vapes/dashboard')).body, 'staff get no money figures').not.toHaveProperty('revenueLast30Days')
  expect(Math.round((dash.revenueLast30Days - revenueBefore) * 100) / 100).toBe(60)
  expect((await as.customer.get('/api/vapes/dashboard')).status).toBe(403)
})
