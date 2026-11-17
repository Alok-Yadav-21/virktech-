import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import { atPinBranch } from './test/atBranch.js'
import pool, { query } from './db.js'
import { createUser } from './utils/users.js'

// Staff dashboard stock screens: sub-category tiles, barcode lookup and linking, stock added by scanning, deliveries, today-only lists.
const PW = 'Password123!'
const PINS = { sidcup: '9201' }
const CODES = { tee: 'TB-ELEC-1', vape: 'TB-VAPE-1', fresh: 'TB-FRESH-1' }
const SUPPLIER = 'TB Supplier'
const as = {}
let blv, sid, tee, bare, vape
const extra = []

const stockOf = async (table, branch, id) => (await query(`SELECT COALESCE(max(stock), 0)::int AS n FROM ${table} WHERE branch_id = $1 AND product_id = $2`, [branch, id])).rows[0].n
const dash = async (pin) => {
  const agent = request.agent(app)
  await atPinBranch(pin)
  expect((await agent.post('/api/auth/pin-login').send({ pin })).status).toBe(200)
  return agent
}
const cleanup = async () => {
  await query('UPDATE products SET barcode = NULL WHERE barcode LIKE $1', ['TB-%'])
  await query('UPDATE vape_products SET barcode = NULL WHERE barcode LIKE $1', ['TB-%'])
  for (const [d, i] of [['deliveries', 'delivery_items'], ['vape_deliveries', 'vape_delivery_items']]) {
    await query(`DELETE FROM ${i} WHERE delivery_id IN (SELECT id FROM ${d} WHERE supplier = $1)`, [SUPPLIER])
    await query(`DELETE FROM ${d} WHERE supplier = $1`, [SUPPLIER])
  }
  await query('DELETE FROM users WHERE pin = ANY($1)', [Object.values(PINS)])
}

beforeAll(async () => {
  await cleanup()
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  sid = (await query("SELECT id FROM branches WHERE area = 'Sidcup'")).rows[0].id
  ;[tee, bare] = (await query('SELECT id FROM products WHERE active ORDER BY id LIMIT 2')).rows.map((r) => r.id)
  vape = (await query('SELECT id FROM vape_products WHERE active ORDER BY id LIMIT 1')).rows[0].id
  await query('UPDATE products SET barcode = $1 WHERE id = $2', [CODES.tee, tee])
  await query('UPDATE vape_products SET barcode = $1 WHERE id = $2', [CODES.vape, vape])
  await query("UPDATE products SET barcode = NULL WHERE id = $1", [bare])
  for (const [t, p, b] of [['branch_stock', tee, blv], ['vape_stock', vape, blv], ['branch_stock', tee, sid]]) {
    await query(`INSERT INTO ${t} (branch_id, product_id, stock) VALUES ($1, $2, 10) ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = 10`, [b, p])
  }
  as.staff = await dash('1234')
  extra.push((await createUser({ name: 'TB Sidcup', role: 'staff', branchId: sid, pin: PINS.sidcup })).id)
  as.sidcup = await dash(PINS.sidcup)
  as.till = request.agent(app)
  await atPinBranch('1234')
  expect((await as.till.post('/api/till/login').send({ pin: '1234' })).status).toBe(200)
  as.customer = request.agent(app)
  expect((await as.customer.post('/api/auth/login').send({ email: 'customer@demo.com', password: PW })).status).toBe(200)
  as.admin = request.agent(app)
  expect((await as.admin.post('/api/auth/login').send({ email: 'admin@demo.com', password: PW })).status).toBe(200)
})

afterAll(async () => {
  await cleanup()
  await pool.end()
})

test('only a staff dashboard session reaches the branch routes', async () => {
  expect((await request(app).get('/api/branch/lookup?code=x')).status).toBe(401)
  expect((await as.till.get('/api/branch/deliveries?kind=vape')).status, 'till cookie alone').toBe(401)
  expect((await as.admin.get('/api/branch/deliveries?kind=vape')).status, 'admin').toBe(403)
  expect((await as.customer.get('/api/branch/deliveries?kind=vape')).status, 'customer').toBe(403)
})

test('the till opens a dashboard for the same person without a second PIN, and only that way round', async () => {
  const fresh = request.agent(app)
  expect((await fresh.post('/api/till/open-dashboard')).status, 'no till sign-in').toBe(401)
  expect((await as.admin.post('/api/till/open-dashboard')).status, 'admin has no till').toBe(401)
  expect((await as.till.post('/api/till/open-dashboard')).status).toBe(200)
  expect((await as.till.get('/api/auth/me')).body).toMatchObject({ name: 'Demo Staff', role: 'staff' })
  expect((await as.staff.get('/api/till/me')).status, 'a dashboard session never opens the till').toBe(401)
  expect((await as.till.get('/api/shifts')).status, 'still no hours or wages').toBe(403)
})

test('tiles can be filtered by sub-category', async () => {
  const cats = (await request(app).get('/api/categories')).body.map((c) => c.name)
  expect(cats).toEqual(expect.arrayContaining(['Speakers', 'Phone covers', 'Chargers & cables']))
  const { category_id: cat } = (await query('SELECT category_id FROM products WHERE id = $1', [tee])).rows[0]
  const inCat = (await as.staff.get(`/api/branch/items?kind=electronics&sub=${cat}`)).body
  expect(inCat.map((i) => i.id)).toContain(tee)
  const all = (await as.staff.get('/api/branch/items?kind=electronics&limit=200')).body
  expect(inCat.length).toBeLessThan(all.length)
  expect(all[0]).toHaveProperty('image')
  expect((await as.staff.get('/api/branch/items?kind=vape&sub=Coil')).body.every((i) => i.id)).toBe(true)
  expect((await as.staff.get('/api/branch/items?kind=vape&sub=Disposable')).status).toBe(400)
  expect((await as.staff.get('/api/branch/items?kind=electronics&sub=abc')).status).toBe(400)
  expect((await as.staff.get('/api/branch/items?kind=nope')).status).toBe(400)
  expect((await as.staff.get(`/api/branch/items?kind=electronics&q=${CODES.tee}`)).body.map((i) => i.id)).toContain(tee)
})

test('a scanned code finds the product in either range, with this branch stock', async () => {
  const e = (await as.staff.get(`/api/branch/lookup?code=${CODES.tee}`)).body
  expect(e).toMatchObject({ kind: 'electronics', id: tee, stock: 10, lastCost: null })
  const v = (await as.staff.get(`/api/branch/lookup?code=${CODES.vape}`)).body
  expect(v).toMatchObject({ kind: 'vape', id: vape, stock: 10 })
  expect((await as.sidcup.get(`/api/branch/lookup?code=${CODES.tee}`)).body.stock, 'their own branch').toBe(10)
  expect((await as.staff.get('/api/branch/lookup?code=NOPE')).status).toBe(404)
  expect((await as.staff.get('/api/branch/lookup?code=')).status).toBe(400)
  expect((await as.till.get(`/api/till/items?q=${CODES.tee}`)).body.map((i) => i.id), 'the till search finds it by code too').toContain(tee)
})

test('an unknown code can be linked once to a product that has none', async () => {
  const link = (body, who = 'staff') => as[who].post('/api/branch/barcode').send(body)
  expect((await link({ kind: 'electronics', productId: bare, code: CODES.fresh })).status).toBe(201)
  expect((await as.staff.get(`/api/branch/lookup?code=${CODES.fresh}`)).body.id).toBe(bare)
  expect((await link({ kind: 'vape', productId: vape, code: CODES.fresh })).status, 'code already used').toBe(409)
  expect((await link({ kind: 'electronics', productId: tee, code: 'TB-OTHER' })).status, 'product already has a code').toBe(409)
  expect((await link({ kind: 'constructor', productId: bare, code: 'TB-X' })).status).toBe(400)
  expect((await link({ kind: 'electronics', productId: 'x', code: 'TB-X' })).status).toBe(400)
})

test('adding stock by scanning changes this branch only', async () => {
  const add = (items, who = 'staff', kind = 'electronics') => as[who].post('/api/branch/stock/add').send({ kind, items })
  expect((await add([{ productId: tee, qty: 5 }])).status).toBe(201)
  expect(await stockOf('branch_stock', blv, tee)).toBe(15)
  expect(await stockOf('branch_stock', sid, tee), 'other branch untouched').toBe(10)
  expect((await add([{ productId: vape, qty: 2 }], 'staff', 'vape')).status).toBe(201)
  expect(await stockOf('vape_stock', blv, vape)).toBe(12)

  expect((await add([])).status).toBe(400)
  expect((await add([{ productId: tee, qty: 0 }])).status).toBe(400)
  expect((await add([{ productId: tee, qty: 1.5 }])).status).toBe(400)
  expect((await add([{ productId: tee, qty: 1 }, { productId: tee, qty: 1 }])).status, 'duplicate line').toBe(400)
  expect((await add([{ productId: 999999, qty: 1 }])).status, 'unknown product').toBe(400)
  expect(await stockOf('branch_stock', blv, tee), 'refusals change nothing').toBe(15)
})

test('a delivery from the till books stock, remembers the cost, and lists today only', async () => {
  const send = (body, who = 'staff') => as[who].post('/api/branch/deliveries').send({ kind: 'electronics', supplier: SUPPLIER, ...body })
  const ok = await send({ items: [{ productId: tee, qty: 3, unitCost: 4.5 }] })
  expect(ok.status).toBe(201)
  expect(ok.body).toMatchObject({ supplier: SUPPLIER, units: 3, branch: { id: blv } })
  expect(await stockOf('branch_stock', blv, tee)).toBe(18)
  expect((await as.staff.get(`/api/branch/lookup?code=${CODES.tee}`)).body.lastCost, 'pre-fill for next time').toBe(4.5)
  expect((await as.sidcup.get(`/api/branch/lookup?code=${CODES.tee}`)).body.lastCost, 'another branch has no cost yet').toBeNull()

  expect((await send({ items: [{ productId: tee, qty: 1 }] })).status, 'cost is required').toBe(400)
  expect((await send({ supplier: '', items: [{ productId: tee, qty: 1, unitCost: 1 }] })).status, 'supplier is required').toBe(400)
  expect((await as.staff.post('/api/branch/deliveries').send({ kind: 'vape', supplier: SUPPLIER, items: [{ productId: vape, qty: 4, unitCost: 2 }] })).status).toBe(201)
  expect(await stockOf('vape_stock', blv, vape)).toBe(16)

  const today = (await as.staff.get('/api/branch/deliveries?kind=electronics')).body
  expect(today.map((d) => d.supplier)).toContain(SUPPLIER)
  expect(today[0].items[0]).toMatchObject({ productId: tee, qty: 3 })
  expect((await as.staff.get('/api/branch/deliveries?kind=vape')).body.every((d) => d.items.every((i) => i.productId)), 'vape list').toBe(true)
  expect((await as.sidcup.get('/api/branch/deliveries?kind=electronics')).body.some((d) => d.supplier === SUPPLIER), 'other branch').toBe(false)
  expect((await as.staff.get('/api/branch/deliveries?kind=nope')).status).toBe(400)

  await query("UPDATE deliveries SET created_at = created_at - interval '2 days' WHERE supplier = $1", [SUPPLIER])
  expect((await as.staff.get('/api/branch/deliveries?kind=electronics')).body.some((d) => d.supplier === SUPPLIER), 'yesterday is not shown').toBe(false)
  const old = (await as.admin.get(`/api/deliveries?q=${SUPPLIER}`)).body
  expect(old.length, 'admin still sees all of it').toBeGreaterThan(0)
  expect((await as.staff.get(`/api/deliveries?q=${SUPPLIER}`)).body, 'staff dashboard list is today only').toEqual([])
  expect((await as.staff.get(`/api/deliveries/${old[0].id}`)).status, 'staff cannot open an old one').toBe(404)
  expect((await as.staff.delete(`/api/deliveries/${old[0].id}`)).status, 'or undo it').toBe(404)
})

test('a tapped product gives the same answer as a scan', async () => {
  const byId = (await as.staff.get(`/api/branch/lookup?kind=electronics&id=${tee}`)).body
  expect(byId).toMatchObject({ kind: 'electronics', id: tee })
  expect((await as.staff.get('/api/branch/lookup?kind=electronics&id=999999')).status).toBe(404)
  expect((await as.staff.get('/api/branch/lookup?kind=electronics&id=abc')).status).toBe(404)
  expect((await as.staff.get('/api/branch/lookup?kind=constructor&id=1')).status).toBe(400)
})
