import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import pool, { query } from './db.js'
import { createUser } from './utils/users.js'

// Role-access and scope checks against the real database. Needs `npm run seed` first (demo users).
// Temporary users and records are created here and removed in afterAll.
const PW = 'Password123!'
const TEMP = { other: 'access-other@test.local' }
const SIDCUP_PIN = '9001'
const refs = { repair: null, tradeIn: null, order: null }
const as = {}

async function loginPin(pin) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/pin-login').send({ pin })
  expect(r.status, `pin login ${pin}`).toBe(200)
  return agent
}

async function login(email) {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ email, password: PW })
  expect(r.status, `login ${email}`).toBe(200)
  return agent
}

beforeAll(async () => {
  const { rows: [blv] } = await query("SELECT id FROM branches WHERE area = 'Belvedere'")
  const { rows: [sid] } = await query("SELECT id FROM branches WHERE area = 'Sidcup'")
  await cleanup() // in case an earlier run died half way
  await createUser({ name: 'Access Sidcup', role: 'staff', branchId: sid.id, pin: SIDCUP_PIN })
  await createUser({ name: 'Access Other', email: TEMP.other, password: PW })

  as.customer = await login('customer@demo.com')
  as.staff = await loginPin('1234') // Belvedere
  as.admin = await login('admin@demo.com')
  as.sidcup = await loginPin(SIDCUP_PIN)
  as.other = await login(TEMP.other)

  const repair = await as.customer.post('/api/repairs').send({ branchId: blv.id, device: { model: 'Access test' }, problem: 'x', fulfilment: 'in_store' })
  const tradeIn = await as.customer.post('/api/tradeins').send({ branchId: blv.id, device: { model: 'Access test' }, condition: 'Good' })
  const { rows: [p] } = await query('SELECT product_id AS id FROM branch_stock WHERE branch_id = $1 AND stock > 0 ORDER BY product_id LIMIT 1', [blv.id])
  const order = await as.customer.post('/api/orders').send({ branchId: blv.id, deliveryMethod: 'collection', paymentMethod: 'cash', items: [{ productId: p.id, qty: 1 }] })
  refs.repair = repair.body.reference
  refs.tradeIn = tradeIn.body.reference
  refs.order = order.body.reference
  expect([repair.status, tradeIn.status, order.status]).toEqual([201, 201, 201])
})

async function cleanup() {
  // Cancel the order first so its stock goes back, then remove everything this file created.
  if (refs.order && as.customer) await as.customer.post(`/api/orders/${refs.order}/cancel`)
  await query('DELETE FROM repairs WHERE reference = $1', [refs.repair])
  await query('DELETE FROM trade_ins WHERE reference = $1', [refs.tradeIn])
  await query('DELETE FROM orders WHERE reference = $1', [refs.order])
  const emails = Object.values(TEMP)
  await query('DELETE FROM loyalty_entries WHERE user_id IN (SELECT id FROM users WHERE email = ANY($1))', [emails])
  await query('DELETE FROM users WHERE email = ANY($1) OR pin = $2', [emails, SIDCUP_PIN])
}

afterAll(async () => {
  await cleanup()
  await pool.end()
})

test('records are scoped: owner, own-branch staff and admin can read; others get 404', async () => {
  for (const [kind, ref] of [['repairs', refs.repair], ['tradeins', refs.tradeIn], ['orders', refs.order]]) {
    const url = `/api/${kind}/${ref}`
    expect((await as.customer.get(url)).status, `${kind} owner`).toBe(200)
    expect((await as.staff.get(url)).status, `${kind} own-branch staff`).toBe(200)
    expect((await as.admin.get(url)).status, `${kind} admin`).toBe(200)
    expect((await as.other.get(url)).status, `${kind} other customer`).toBe(404)
    expect((await as.sidcup.get(url)).status, `${kind} other-branch staff`).toBe(404)
  }
})

test('lists only contain what the caller may see', async () => {
  for (const kind of ['repairs', 'tradeins', 'orders']) {
    expect((await as.other.get(`/api/${kind}`)).body, `${kind} other customer`).toEqual([])
    expect((await as.sidcup.get(`/api/${kind}`)).body, `${kind} other-branch staff`).toEqual([])
    expect((await as.staff.get(`/api/${kind}`)).body.length, `${kind} branch staff`).toBeGreaterThan(0)
  }
})

test('out-of-scope writes are refused', async () => {
  const r = refs.repair
  expect((await as.sidcup.patch(`/api/repairs/${r}/status`).send({ status: 'Device received' })).status).toBe(404)
  expect((await as.other.patch(`/api/repairs/${r}/status`).send({ status: 'Cancelled', reason: 'x' })).status).toBe(404)
  expect((await as.sidcup.patch(`/api/orders/${refs.order}/pay`)).status).toBe(404)
  expect((await as.other.post(`/api/tradeins/${refs.tradeIn}/respond`).send({ action: 'cancel' })).status).toBe(404)
})

test('customers cannot use staff or admin routes', async () => {
  const c = as.customer
  expect((await c.get('/api/users')).status).toBe(403)
  expect((await c.post('/api/products').send({})).status).toBe(403)
  expect((await c.get('/api/products?all=1')).status).toBe(403)
  expect((await c.patch('/api/stock/1').send({ stock: 1 })).status).toBe(403)
  expect((await c.get('/api/stock')).status).toBe(403)
  expect((await c.patch(`/api/repairs/${refs.repair}/quote`).send({ quote: 5 })).status).toBe(403)
  expect((await c.patch(`/api/orders/${refs.order}/status`).send({ status: 'processing' })).status).toBe(403)
  expect((await c.patch(`/api/tradeins/${refs.tradeIn}`).send({ finalOffer: 99 })).status).toBe(403)
  expect((await c.get('/api/loyalty/lookup?email=customer@demo.com')).status).toBe(403)
  expect((await c.post('/api/loyalty/redeem').send({})).status).toBe(403)
  expect((await c.post('/api/loyalty/adjust').send({})).status).toBe(403)
})

test('staff cannot use admin routes or place customer bookings', async () => {
  const s = as.staff
  expect((await s.get('/api/users')).status).toBe(403)
  expect((await s.post('/api/products').send({})).status).toBe(403)
  expect((await s.delete('/api/branches/1')).status).toBe(403)
  expect((await s.post('/api/loyalty/adjust').send({ userId: 1, delta: 5, note: 'x' })).status).toBe(403)
  expect((await s.patch(`/api/repairs/${refs.repair}/technician`).send({ technicianId: null })).status).toBe(403)
  expect((await s.post('/api/repairs').send({})).status).toBe(403)
  expect((await s.post('/api/orders').send({})).status).toBe(403)
})

test('role and id sent by the client are never trusted', async () => {
  const reg = await request(app).post('/api/auth/register').send({ name: 'x', email: 'sneaky@test.local', password: 'Password123!', role: 'admin' })
  if (reg.status === 201) {
    expect(reg.body.role).toBe('customer')
    await query("DELETE FROM users WHERE email = 'sneaky@test.local'")
  }
  expect((await as.customer.patch('/api/auth/me').send({ role: 'admin' })).body.role).toBe('customer')
})

test('admin can reach the admin routes', async () => {
  expect((await as.admin.get('/api/users')).status).toBe(200)
  expect((await as.admin.get('/api/products?all=1')).status).toBe(200)
  expect((await as.admin.get('/api/dashboard/stats')).body.role).toBe('admin')
})

test('a deactivated account is locked out on its next request', async () => {
  await query('UPDATE users SET active = false WHERE email = $1', [TEMP.other])
  expect((await as.other.get('/api/auth/me')).status).toBe(401)
})
