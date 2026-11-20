import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import { atPinBranch, tokenOf } from './test/atBranch.js'
import { createUser } from './utils/users.js'
import pool, { query } from './db.js'

// Counter sales: stock, the two ranges kept apart, ID check, voids and who may use the till.
const PW = 'Password123!'
const as = {}
let blv, tee, vape, demo
const extra = {} // staff made by the clock-in tests

const stock = async (table, id) => (await query(`SELECT stock FROM ${table} WHERE branch_id = $1 AND product_id = $2`, [blv, id])).rows[0].stock
const sell = (items, extra = {}) => as.staff.post('/api/till/sales').send({ items, paymentMethod: 'cash', ...extra })

beforeAll(async () => {
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  tee = (await query('SELECT id FROM products WHERE active ORDER BY id LIMIT 1')).rows[0].id
  vape = (await query('SELECT id FROM vape_products WHERE active ORDER BY id LIMIT 1')).rows[0].id
  await query('UPDATE branch_stock SET stock = 50 WHERE branch_id = $1 AND product_id = $2', [blv, tee])
  await query('UPDATE vape_stock SET stock = 50 WHERE branch_id = $1 AND product_id = $2', [blv, vape])
  // The till has its own sign-in; `dash` is the same person on the normal dashboard login.
  demo = (await query("SELECT id FROM users WHERE pin = '123456'")).rows[0].id
  await query('DELETE FROM shifts WHERE user_id = $1', [demo])
  // One person, one live sign-in: the dashboard first, then the till "on the same computer" (see tokenOf), so the two
  // agents hold one cookie each (the separation tests below depend on that) but are the same login.
  as.dash = request.agent(app)
  await atPinBranch('123456')
  const dashRes = await as.dash.post('/api/auth/pin-login').send({ pin: '123456' })
  expect(dashRes.status).toBe(200)
  as.staff = request.agent(app)
  await atPinBranch('123456', { keepLogin: true })
  expect((await as.staff.post('/api/till/login').set('Cookie', `token=${tokenOf(dashRes)}`).send({ pin: '123456' })).status).toBe(200)
  expect((await as.staff.get('/api/till/me')).body.onShift, 'signing in at the till clocked them in').toBe(true)
  for (const [k, email] of [['admin', 'admin@demo.com'], ['customer', 'customer@demo.com']]) {
    as[k] = request.agent(app)
    expect((await as[k].post('/api/auth/login').send({ email, password: PW })).status).toBe(200)
  }
})

afterAll(async () => {
  await query("DELETE FROM orders WHERE sold_by IS NOT NULL")
  await query("DELETE FROM vape_orders WHERE sold_by IS NOT NULL")
  await query('DELETE FROM shifts WHERE user_id = ANY($1)', [[demo, ...Object.values(extra)]])
  await query('DELETE FROM users WHERE id = ANY($1)', [Object.values(extra)])
  await pool.end()
})

test('only staff can use the till', async () => {
  expect((await request(app).get('/api/till/items')).status).toBe(401)
  for (const who of ['admin', 'customer']) {
    // Their dashboard login means nothing here, and there is no till sign-in for them (staff PINs only).
    expect((await as[who].get('/api/till/items')).status, who).toBe(401)
    expect((await as[who].post('/api/till/sales').send({})).status, who).toBe(401)
  }
})

test('items list both ranges with this branch stock, searchable', async () => {
  const all = (await as.staff.get('/api/till/items?limit=200')).body
  expect(new Set(all.map((i) => i.kind))).toEqual(new Set(['electronics', 'vape']))
  const one = all.find((i) => i.kind === 'electronics' && i.id === tee)
  expect(one.stock).toBe(50)
  expect((await as.staff.get('/api/till/items?kind=vape')).body.every((i) => i.kind === 'vape')).toBe(true)
  expect((await as.staff.get(`/api/till/items?q=${encodeURIComponent(one.name)}`)).body.some((i) => i.id === tee)).toBe(true)
  expect((await as.staff.get('/api/till/items?q=%25')).body, 'a literal % matches nothing').toEqual([])
})

test('an electronics sale takes stock and is a paid, collected order the reports can see', async () => {
  const before = await stock('branch_stock', tee)
  const r = await sell([{ kind: 'electronics', productId: tee, qty: 2 }, { kind: 'electronics', productId: tee, qty: 1 }], { price: 0.01, branchId: 999 })
  expect(r.status).toBe(201)
  expect(r.body.vape).toBeNull()
  expect(r.body.electronics.lines).toHaveLength(1) // repeated lines merge
  expect(r.body.electronics.lines[0].qty).toBe(3)
  expect(await stock('branch_stock', tee)).toBe(before - 3)
  const { rows: [o] } = await query('SELECT * FROM orders WHERE reference = $1', [r.body.electronics.reference])
  expect(o).toMatchObject({ status: 'collected', payment_status: 'paid', branch_id: blv, delivery_method: 'collection' })
  expect(Number(o.total)).toBe(r.body.total)
  expect(Number(o.total), 'price comes from the database').toBeGreaterThan(0.03)
  const walkIn = (await query("SELECT id FROM users WHERE email = 'walk-in@till.local'")).rows[0].id
  expect(o.customer_id).toBe(walkIn)
})

test('vapes need an ID check and use their own tables; a mixed basket keeps the totals apart', async () => {
  const items = [{ kind: 'vape', productId: vape, qty: 1 }]
  expect((await sell(items)).status, 'no ID check').toBe(400)
  expect((await sell(items, { idChecked: 'yes' })).status).toBe(400)
  const before = await stock('vape_stock', vape)

  const r = await sell([...items, { kind: 'electronics', productId: tee, qty: 1 }], { idChecked: true, paymentMethod: 'card_in_store' })
  expect(r.status).toBe(201)
  expect(r.body.vape.reference).toMatch(/^VP-ORD-/)
  expect(r.body.electronics.reference).toMatch(/^VT-ORD-/)
  expect(r.body.total).toBeCloseTo(r.body.vape.total + r.body.electronics.total, 2)
  expect(await stock('vape_stock', vape)).toBe(before - 1)
  const { rows: [v] } = await query('SELECT * FROM vape_orders WHERE reference = $1', [r.body.vape.reference])
  expect(v).toMatchObject({ status: 'collected', payment_status: 'paid', age_confirmed: true, payment_method: 'card_in_store' })
  expect(Number(v.total)).toBe(r.body.vape.total)
})

test('bad baskets are refused and short stock rolls the whole sale back', async () => {
  expect((await sell([])).status).toBe(400)
  expect((await sell([{ kind: 'electronics', productId: tee, qty: 0 }])).status).toBe(400)
  expect((await sell([{ kind: 'nope', productId: tee, qty: 1 }])).status).toBe(400)
  expect((await sell([{ kind: 'electronics', productId: tee, qty: 1 }], { paymentMethod: 'bitcoin' })).status).toBe(400)

  await query('UPDATE vape_stock SET stock = 1 WHERE branch_id = $1 AND product_id = $2', [blv, vape])
  const teeBefore = await stock('branch_stock', tee)
  const r = await sell([{ kind: 'electronics', productId: tee, qty: 1 }, { kind: 'vape', productId: vape, qty: 2 }], { idChecked: true })
  expect(r.status).toBe(409)
  expect(await stock('branch_stock', tee), 'electronics stock untouched').toBe(teeBefore)
  expect(await stock('vape_stock', vape)).toBe(1)
  await query('UPDATE vape_stock SET stock = 50 WHERE branch_id = $1 AND product_id = $2', [blv, vape])
})

test("today's takings split cash and card; a void puts stock back and drops out of revenue", async () => {
  await query('DELETE FROM orders WHERE sold_by IS NOT NULL')
  await query('DELETE FROM vape_orders WHERE sold_by IS NOT NULL')
  const a = await sell([{ kind: 'electronics', productId: tee, qty: 1 }])
  const b = await sell([{ kind: 'vape', productId: vape, qty: 1 }], { idChecked: true, paymentMethod: 'card_in_store' })
  const today = (await as.staff.get('/api/till/today')).body
  expect(today.summary.count).toBe(2)
  expect(today.summary.cash).toBe(a.body.total)
  expect(today.summary.card).toBe(b.body.total)
  expect(today.summary.electronics).toBe(a.body.total)
  expect(today.summary.vape).toBe(b.body.total)

  const before = await stock('branch_stock', tee)
  const ref = a.body.electronics.reference
  expect((await as.staff.post(`/api/till/sales/${ref}/void`)).status).toBe(200)
  expect(await stock('branch_stock', tee)).toBe(before + 1)
  const { rows: [o] } = await query('SELECT status, payment_status FROM orders WHERE reference = $1', [ref])
  expect(o).toEqual({ status: 'cancelled', payment_status: 'refunded' })
  expect((await as.staff.post(`/api/till/sales/${ref}/void`)).status, 'cannot void twice').toBe(404)
  expect((await as.staff.post('/api/till/sales/VT-ORD-1/void')).status, 'not a till sale').toBe(404)
  expect((await as.staff.get('/api/till/today')).body.summary).toMatchObject({ count: 1, cash: 0, electronics: 0 })
})

test('the walk-in account cannot log in and is not listed as a customer', async () => {
  expect((await request(app).post('/api/auth/login').send({ email: 'walk-in@till.local', password: PW })).status).toBe(401)
  const list = (await as.admin.get('/api/users?role=customer&limit=500')).body
  expect(list.some((u) => u.email === 'walk-in@till.local')).toBe(false)
  expect(list.some((u) => u.email === 'customer@demo.com')).toBe(true)
})

const tillAs = async (pin) => {
  const agent = request.agent(app)
  await atPinBranch(pin)
  expect((await agent.post('/api/till/login').send({ pin })).status).toBe(200)
  return agent
}

test('the till and the dashboard are separate sign-ins', async () => {
  // A dashboard session cannot use the till, and a till session cannot reach anything personal.
  expect((await as.dash.get('/api/till/items')).status).toBe(401)
  for (const url of ['/api/auth/me', '/api/shifts', '/api/dashboard/stats']) {
    expect((await as.staff.get(url)).status, `till session on ${url}`).toBe(401)
  }
  expect((await as.staff.post('/api/shifts/end')).status).toBe(401)
  expect((await as.dash.get('/api/shifts')).status, 'staff never see hours or wages').toBe(403)
  expect((await as.admin.get('/api/shifts')).status).toBe(200)
  // PIN rules: wrong PIN, and only staff PINs.
  await atPinBranch('000000')
  expect((await request(app).post('/api/till/login').send({ pin: '000000' })).status).toBe(401)
  expect((await request(app).post('/api/till/login').send({})).status).toBe(401)
  const me = (await as.staff.get('/api/till/me')).body
  expect(me).toMatchObject({ name: 'Demo Staff', onShift: true })
  expect(JSON.stringify(me)).not.toMatch(/wage|pin|hours/i)
  // Switch person: signing out of the till ends no shift. (Someone else, since Demo Staff is signed in above.)
  extra.switcher = (await createUser({ name: 'Switch Person', role: 'staff', branchId: blv, pin: '777300', dailyWage: 70 })).id
  const other = await tillAs('777300')
  expect((await other.get('/api/till/me')).body.onShift, 'signing in clocked them in').toBe(true)
  expect((await other.post('/api/till/logout')).status).toBe(200)
  expect((await other.get('/api/till/me')).status).toBe(401)
  expect((await query('SELECT 1 FROM shifts WHERE user_id = $1 AND ended_at IS NULL', [extra.switcher])).rowCount).toBe(1)
})

test('anyone from this branch can clock in and out at the till with their own PIN', async () => {
  const sid = (await query("SELECT id FROM branches WHERE area = 'Sidcup'")).rows[0].id
  extra.mate = (await createUser({ name: 'Till Mate', role: 'staff', branchId: blv, pin: '777100', dailyWage: 70 })).id
  extra.away = (await createUser({ name: 'Till Away', role: 'staff', branchId: sid, pin: '777200' })).id
  const clock = (pin, action) => as.staff.post('/api/till/clock').send({ pin, action })

  expect((await clock('777100', 'start')).body).toMatchObject({ name: 'Till Mate', action: 'start' })
  expect((await clock('777100', 'start')).status, 'already on shift').toBe(409)
  const crew = (await as.staff.get('/api/till/crew')).body
  expect(crew.find((c) => c.name === 'Till Mate').onShift).toBe(true)
  expect(crew.some((c) => c.name === 'Till Away'), 'other branches are not listed').toBe(false)
  expect(JSON.stringify(crew), 'no pay, times or PINs').not.toMatch(/wage|pin|started|7771/i)
  expect((await query('SELECT daily_wage FROM shifts WHERE user_id = $1', [extra.mate])).rows[0].daily_wage).toBe(70)

  expect((await clock('777200', 'start')).status, 'another branch').toBe(403)
  expect((await clock('000000', 'start')).status, 'wrong PIN').toBe(401)
  expect((await clock('777100', 'nope')).status, 'bad action').toBe(400)
  expect((await clock('777100', 'end')).status).toBe(200)
  expect((await clock('777100', 'end')).status, 'nothing to end').toBe(409)
  expect((await request(app).post('/api/till/clock').send({ pin: '777100', action: 'start' })).status, 'needs a till sign-in').toBe(401)
})

test('a sale needs the seller on shift, and admin can see who is working', async () => {
  const mate = await tillAs('777100')
  expect((await mate.post('/api/till/shift/end')).status, 'signing in clocked Till Mate in; take that back').toBe(200)
  const res = await mate.post('/api/till/sales').send({ items: [{ kind: 'electronics', productId: tee, qty: 1 }], paymentMethod: 'cash' })
  expect(res.status).toBe(409)
  expect(res.body.message).toMatch(/shift/i)
  expect((await mate.post('/api/till/shift/start')).status).toBe(201)
  expect((await mate.post('/api/till/sales').send({ items: [{ kind: 'electronics', productId: tee, qty: 1 }], paymentMethod: 'cash' })).status).toBe(201)
  expect((await mate.post('/api/till/shift/end')).status).toBe(200)

  const now = (await as.admin.get('/api/shifts/now')).body
  expect(now.find((n) => n.name === 'Demo Staff')).toMatchObject({ branchName: 'Belvedere' })
  expect(now.some((n) => n.name === 'Till Mate'), 'ended shifts are not listed').toBe(false)
  expect((await as.dash.get('/api/shifts/now')).status).toBe(403)
  expect((await as.customer.get('/api/shifts/now')).status).toBe(403)
})

test('sign-in cookies are session cookies, so closing the browser signs out', async () => {
  await atPinBranch('123456')
  const till = await request(app).post('/api/till/login').send({ pin: '123456' })
  const dash = await request(app).post('/api/auth/login').send({ email: 'customer@demo.com', password: PW })
  for (const r of [till, dash]) {
    const c = r.headers['set-cookie'].join(';')
    expect(c).not.toMatch(/Max-Age|Expires/i)
  }
})

test('admin sets a staff role; deleting staff hides them and frees the PIN', async () => {
  const b = (await as.admin.get('/api/branches')).body[0].id
  const bad = await as.admin.post('/api/users').send({ name: 'Role Test', pin: '919100', role: 'staff', branchId: b, staffRole: 'Wizard' })
  expect(bad.status).toBe(400)
  const made = await as.admin.post('/api/users').send({ name: 'Role Test', pin: '919100', role: 'staff', branchId: b, staffRole: 'Repairer' })
  expect(made.body.staffRole).toBe('Repairer')
  expect((await as.admin.put(`/api/users/${made.body.id}`).send({ staffRole: 'Manager' })).body.staffRole).toBe('Manager')
  expect((await as.admin.delete(`/api/users/${made.body.id}`)).status).toBe(200)
  const list = (await as.admin.get('/api/users?role=staff&active=1&limit=100')).body
  expect(list.some((u) => u.id === made.body.id)).toBe(false)
  await atPinBranch('919100')
  expect((await request(app).post('/api/till/login').send({ pin: '919100' })).status, 'deleted staff cannot sign in').toBe(401)
  expect((await as.admin.post('/api/users').send({ name: 'Reuse', pin: '919100', role: 'staff', branchId: b })).status, 'PIN is free again').toBe(201)
})

test('a shop IP places staff at that shop; any other IP signs in to the dashboard with no branch, but cannot open the till', async () => {
  const [a, b] = (await as.admin.get('/api/branches?all=1')).body
  const mate = (await query("SELECT id FROM users WHERE pin = '777100'")).rows[0].id
  await query('UPDATE users SET login_sid = NULL WHERE id = $1', [mate]) // earlier tests left Till Mate signed in
  await query("UPDATE users SET branch_id = NULL WHERE id = $1", [mate])
  await query('UPDATE branches SET ip = NULL')
  expect((await request(app).post('/api/till/login').send({ pin: '777100' })).status, 'no branch has this IP').toBe(403)
  const dashRes = await request(app).post('/api/auth/pin-login').send({ pin: '777100' })
  expect(dashRes.status, 'the dashboard signs in anywhere').toBe(200)
  expect(dashRes.body.branch).toBeNull()
  await query('UPDATE users SET login_sid = NULL WHERE id = $1', [mate]) // that dashboard sign-in took it
  expect((await as.admin.put(`/api/branches/${b.id}`).send({ ip: 'not an ip' })).status).toBe(400)
  expect((await as.admin.get('/api/branches/my-ip')).body.ip).toBe('127.0.0.1')
  expect((await as.admin.put(`/api/branches/${b.id}`).send({ ip: '127.0.0.1' })).body.ip).toBe('127.0.0.1')
  expect((await as.admin.put(`/api/branches/${a.id}`).send({ ip: '127.0.0.1' })).status, 'one IP, one branch').toBe(409)
  expect((await request(app).post('/api/till/login').send({ pin: '777100' })).body.branchId).toBe(b.id)
  const row = (await as.admin.get('/api/users?role=staff&q=Till Mate')).body[0]
  expect(row.branchName).toBe(b.area)
  expect(row.lastLoginAt).toBeTruthy()
  expect((await request(app).get('/api/branches')).body.every((x) => !('ip' in x)), 'IP is admin-only').toBe(true)
  await query('UPDATE branches SET ip = NULL')
  await query("UPDATE branches SET ip = '127.0.0.1' WHERE id = $1", [a.id]) // back to the seed state
})
