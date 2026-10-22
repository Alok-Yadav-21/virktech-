import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import pool, { query } from './db.js'

// End-to-end business flows against the (test) database, as each role would drive them.
const PW = 'Password123!'
const as = {}
let blv, sid, macbook, cable

const login = async (email, password = PW) => {
  const agent = request.agent(app)
  const r = await agent.post('/api/auth/login').send({ email, password })
  expect(r.status, `login ${email}`).toBe(200)
  return agent
}
const stockAt = async (branchId, productId) => (await query('SELECT stock FROM branch_stock WHERE branch_id = $1 AND product_id = $2', [branchId, productId])).rows[0]?.stock ?? 0
const balance = async () => (await as.cust.get('/api/loyalty/me')).body.balance
const order = (items, extra = {}) => as.cust.post('/api/orders').send({ branchId: blv, deliveryMethod: 'collection', paymentMethod: 'cash', items, ...extra })
const collect = async (ref) => {
  await as.staff.patch(`/api/orders/${ref}/pay`)
  for (const s of ['processing', 'ready', 'collected']) await as.staff.patch(`/api/orders/${ref}/status`).send({ status: s })
}

beforeAll(async () => {
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  sid = (await query("SELECT id FROM branches WHERE area = 'Sidcup'")).rows[0].id
  as.admin = await login('admin@demo.com')
  as.staff = await login('staff@demo.com')
  as.cust = await login('customer@demo.com')
  const products = (await request(app).get('/api/products')).body
  macbook = products.find((p) => p.name.startsWith('MacBook Air 13')).id
  cable = products.find((p) => p.name === 'USB-C Fast Charging Cable').id

  const staff = await as.admin.post('/api/users').send({ name: 'Flows Sidcup', email: 'flows-sidcup@test.local', password: PW, role: 'staff', branchId: sid })
  expect(staff.status).toBe(201)
  as.sidcup = await login('flows-sidcup@test.local')
  as.other = request.agent(app)
  expect((await as.other.post('/api/auth/register').send({ name: 'Flows Other', email: 'flows-other@test.local', password: PW })).status).toBe(201)
})

afterAll(() => pool.end())

// ---------------------------------------------------------------- stock per branch
test('stock is counted per branch: staff manage their own branch, admin any', async () => {
  expect((await as.staff.get('/api/stock')).body.length).toBeGreaterThan(20)
  expect((await as.staff.patch(`/api/stock/${cable}`).send({ stock: 7 })).body).toMatchObject({ branchId: blv, stock: 7 })
  expect((await as.staff.patch(`/api/stock/${cable}`).send({ stock: 7, branchId: sid })).status, 'staff naming another branch').toBe(403)
  expect((await as.staff.get(`/api/stock?branchId=${sid}`)).status).toBe(403)
  expect((await as.staff.patch(`/api/stock/${cable}`).send({ stock: -1 })).status).toBe(400)
  expect((await as.staff.patch(`/api/stock/${cable}`).send({ stock: 1.5 })).status).toBe(400)
  expect((await as.cust.patch(`/api/stock/${cable}`).send({ stock: 1 })).status).toBe(403)
  expect((await as.admin.patch(`/api/stock/${cable}`).send({ stock: 4, branchId: sid })).status).toBe(200)
  expect((await as.admin.get('/api/stock')).status, 'admin must name a branch').toBe(400)
  expect(await stockAt(blv, cable)).toBe(7)
  expect(await stockAt(sid, cable)).toBe(4)
  const availability = (await request(app).get(`/api/products/${cable}/availability`)).body
  expect(availability.find((b) => b.branchId === sid).stock).toBe(4)
  expect((await request(app).get(`/api/products/${cable}`)).body.stockTotal).toBeGreaterThan(10)
})

test('an order takes stock from the chosen branch only, and cancelling puts it back there', async () => {
  const [b0, s0] = [await stockAt(blv, macbook), await stockAt(sid, macbook)]
  const r = await order([{ productId: macbook, qty: 2, price: 0.01 }])
  expect(r.status).toBe(201)
  expect(r.body.total, 'price comes from the server').toBe(1498)
  expect(await stockAt(blv, macbook)).toBe(b0 - 2)
  expect(await stockAt(sid, macbook), 'other branch untouched').toBe(s0)
  expect((await as.cust.post(`/api/orders/${r.body.reference}/cancel`)).status).toBe(200)
  expect(await stockAt(blv, macbook)).toBe(b0)
})

test('overselling at a branch is refused with the branch named, and nothing is taken', async () => {
  await as.admin.patch(`/api/stock/${cable}`).send({ stock: 0, branchId: sid })
  const before = await stockAt(blv, macbook)
  const r = await order([{ productId: macbook, qty: 1 }, { productId: cable, qty: 1 }], { branchId: sid })
  expect(r.status).toBe(409)
  expect(r.body.message).toMatch(/Not enough stock.*Sidcup/)
  expect(await stockAt(blv, macbook)).toBe(before)
  expect(await stockAt(sid, macbook), 'earlier line rolled back').toBe(10)
  expect((await order([])).status).toBe(400)
  expect((await order([{ productId: macbook, qty: 0 }])).status).toBe(400)
  expect((await order([{ productId: 999999, qty: 1 }])).status).toBe(409)
  expect((await as.staff.post('/api/orders').send({})).status).toBe(403)
})

test('five simultaneous orders for the last unit: exactly one wins', async () => {
  await as.staff.patch(`/api/stock/${cable}`).send({ stock: 1 })
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => order([{ productId: cable, qty: 1 }])))
  expect(results.filter((r) => r.status === 201)).toHaveLength(1)
  expect(await stockAt(blv, cable)).toBe(0)
  await as.staff.patch(`/api/stock/${cable}`).send({ stock: 20 })
})

// ---------------------------------------------------------------- order lifecycle
test('collection and delivery orders follow their own paths', async () => {
  let r = await order([{ productId: cable, qty: 1 }])
  const ref = r.body.reference
  expect((await as.cust.patch(`/api/orders/${ref}/status`).send({ status: 'processing' })).status).toBe(403)
  expect((await as.cust.patch(`/api/orders/${ref}/pay`)).status).toBe(403)
  expect((await as.staff.patch(`/api/orders/${ref}/status`).send({ status: 'collected' })).status, 'cannot skip').toBe(400)
  r = await as.staff.patch(`/api/orders/${ref}/pay`)
  expect(r.body).toMatchObject({ status: 'paid', paymentStatus: 'paid' })
  expect((await as.staff.patch(`/api/orders/${ref}/pay`)).status, 'pay twice').toBe(400)
  for (const s of ['processing', 'ready', 'collected']) expect((await as.staff.patch(`/api/orders/${ref}/status`).send({ status: s })).status).toBe(200)
  expect((await as.cust.post(`/api/orders/${ref}/cancel`)).status, 'cannot cancel once collected').toBe(400)

  r = await order([{ productId: cable, qty: 1 }], { deliveryMethod: 'delivery', address: { line1: '1 High St', city: 'London', postcode: 'SE18 1AA' } })
  expect(r.status).toBe(201)
  const d = r.body.reference
  expect((await order([{ productId: cable, qty: 1 }], { deliveryMethod: 'delivery' })).status, 'delivery needs an address').toBe(400)
  await as.staff.patch(`/api/orders/${d}/status`).send({ status: 'processing' })
  expect((await as.staff.patch(`/api/orders/${d}/status`).send({ status: 'ready' })).status).toBe(400)
  expect((await as.staff.patch(`/api/orders/${d}/status`).send({ status: 'dispatched' })).status).toBe(200)
  expect((await as.staff.post(`/api/orders/${d}/cancel`)).status, 'cannot cancel once dispatched').toBe(400)
  expect((await as.staff.patch(`/api/orders/${d}/status`).send({ status: 'delivered' })).status).toBe(200)
})

// ---------------------------------------------------------------- repairs
test('a repair goes from booking to payment and completion', async () => {
  let r = await as.cust.post('/api/repairs').send({ branchId: blv, device: { category: 'Phone', brand: 'Apple', model: 'iPhone 13' }, problem: 'Cracked screen', fulfilment: 'in_store' })
  expect(r.status).toBe(201)
  const ref = r.body.reference
  const u = `/api/repairs/${ref}`
  const move = (agent, status, reason) => agent.patch(`${u}/status`).send({ status, reason })

  expect((await as.cust.post('/api/repairs').send({ branchId: blv, device: {}, problem: 'x', fulfilment: 'in_store' })).status).toBe(400)
  expect((await as.cust.post('/api/repairs').send({ branchId: blv, device: { model: 'x' }, problem: 'y'.repeat(2001), fulfilment: 'in_store' })).status, 'length cap').toBe(400)
  expect((await as.other.get(u)).status).toBe(404)
  expect((await as.sidcup.get(u)).status).toBe(404)
  expect((await move(as.staff, 'Completed')).status, 'skip refused').toBe(400)
  await move(as.staff, 'Device received'); await move(as.staff, 'Diagnostics')
  expect((await move(as.staff, 'Quote awaiting approval')).status, 'no amount').toBe(400)
  expect((await as.staff.patch(`${u}/quote`).send({ quote: 100 })).status).toBe(200)
  expect((await as.cust.get(u)).body.quote, 'hidden until sent').toBeNull()
  expect((await move(as.staff, 'Quote awaiting approval')).status).toBe(200)
  expect((await as.cust.get(u)).body.quote).toBe(100)
  expect((await move(as.staff, 'Repair in progress')).status, 'staff cannot approve for the customer').toBe(400)
  expect((await as.staff.patch(`${u}/quote`).send({ quote: 5 })).status, 'quote locked').toBe(409)
  expect((await move(as.cust, 'Repair in progress')).status).toBe(200)

  await as.staff.post(`${u}/notes`).send({ text: 'internal', visibleToCustomer: false })
  await as.staff.post(`${u}/notes`).send({ text: 'public', visibleToCustomer: true })
  await as.staff.post(`${u}/parts`).send({ name: 'Screen', cost: 45 })
  const mine = (await as.cust.get(u)).body
  expect([mine.notes.length, mine.parts, mine.technician]).toEqual([1, undefined, undefined])

  const tech = (await query("SELECT id FROM users WHERE email = 'staff@demo.com'")).rows[0].id
  const other = (await query("SELECT id FROM users WHERE email = 'flows-sidcup@test.local'")).rows[0].id
  expect((await as.staff.patch(`${u}/technician`).send({ technicianId: tech })).status).toBe(403)
  expect((await as.admin.patch(`${u}/technician`).send({ technicianId: other })).status, 'wrong branch').toBe(400)
  expect((await as.admin.patch(`${u}/technician`).send({ technicianId: tech })).body.technician.id).toBe(tech)

  await move(as.staff, 'Quality check')
  expect((await as.staff.patch(`${u}/pay`)).status, 'not ready yet').toBe(400)
  await move(as.staff, 'Ready for collection')
  expect((await as.cust.patch(`${u}/pay`)).status).toBe(403)
  expect((await move(as.staff, 'Completed')).status, 'cannot complete unpaid').toBe(400)
  const paid = await as.staff.patch(`${u}/pay`)
  expect(paid.body).toMatchObject({ paymentStatus: 'paid', amountDue: 100 })
  expect((await as.staff.patch(`${u}/pay`)).status, 'pay twice').toBe(400)
  const before = await balance()
  expect((await move(as.staff, 'Completed')).status).toBe(200)
  expect(await balance(), '£100 earns 50 points').toBe(before + 50)
  expect((await move(as.staff, 'Cancelled', 'x')).status, 'completed is final').toBe(400)
})

test('cancelling a paid repair marks it refunded; a customer can cancel a fresh booking and decline a quote', async () => {
  const book = async () => (await as.cust.post('/api/repairs').send({ branchId: blv, device: { model: 'Pixel' }, problem: 'Battery', fulfilment: 'mail_in' })).body.reference
  const patch = (ref, p, body) => as.staff.patch(`/api/repairs/${ref}/${p}`).send(body)

  const a = await book()
  for (const s of ['Device received', 'Diagnostics']) await patch(a, 'status', { status: s })
  await patch(a, 'quote', { quote: 60 }); await patch(a, 'status', { status: 'Quote awaiting approval' })
  await as.cust.patch(`/api/repairs/${a}/status`).send({ status: 'Repair in progress' })
  for (const s of ['Quality check', 'Ready for collection']) await patch(a, 'status', { status: s })
  await patch(a, 'pay', {})
  const cancelled = await patch(a, 'status', { status: 'Cancelled', reason: 'customer left it' })
  expect(cancelled.body).toMatchObject({ status: 'Cancelled', paymentStatus: 'refunded' })

  const b = await book()
  expect((await patch(b, 'status', { status: 'Cancelled' })).status, 'reason required').toBe(400)
  const own = await as.cust.patch(`/api/repairs/${b}/status`).send({ status: 'Cancelled', reason: 'changed my mind' })
  expect(own.body.cancelReason).toBe('changed my mind')

  const c = await book()
  for (const s of ['Device received', 'Diagnostics']) await patch(c, 'status', { status: s })
  await patch(c, 'quote', { quote: 50 }); await patch(c, 'status', { status: 'Quote awaiting approval' })
  expect((await as.cust.patch(`/api/repairs/${c}/status`).send({ status: 'Cancelled' })).body.cancelReason).toBe('Customer declined the quote')
})

// ---------------------------------------------------------------- trade-ins
test('a trade-in goes from request to payment, with the offer hidden until sent', async () => {
  const body = { branchId: blv, device: { category: 'Phone', brand: 'Apple', model: 'iPhone 12' }, condition: 'Good', details: 'Scratch', photos: ['https://example.com/a.jpg'] }
  const r = await as.cust.post('/api/tradeins').send(body)
  expect(r.status).toBe(201)
  const u = `/api/tradeins/${r.body.reference}`
  expect((await as.cust.post('/api/tradeins').send({ ...body, condition: 'Mint' })).status).toBe(400)
  expect((await as.cust.post('/api/tradeins').send({ ...body, photos: ['javascript:alert(1)'] })).status).toBe(400)
  expect((await as.other.get(u)).status).toBe(404)
  expect((await as.sidcup.patch(u).send({ status: 'valuation_review' })).status).toBe(404)
  expect((await as.cust.patch(u).send({ finalOffer: 999 })).status).toBe(403)
  expect((await as.staff.patch(u).send({ status: 'offer_sent' })).status, 'skip refused').toBe(400)
  await as.staff.patch(u).send({ status: 'valuation_review', indicativeValue: 150 })
  expect((await as.staff.patch(u).send({ status: 'offer_sent' })).status, 'no amount').toBe(400)
  await as.staff.patch(u).send({ finalOffer: 140 })
  expect((await as.cust.get(u)).body).toMatchObject({ finalOffer: null, indicativeValue: 150 })
  expect((await as.staff.patch(u).send({ status: 'offer_sent' })).status).toBe(200)
  expect((await as.cust.get(u)).body.finalOffer).toBe(140)
  expect((await as.staff.patch(u).send({ finalOffer: 10 })).status, 'offer locked').toBe(409)
  expect((await as.admin.patch(u).send({ status: 'offer_accepted' })).status, 'staff cannot accept').toBe(400)
  expect((await as.other.post(`${u}/respond`).send({ action: 'accept' })).status).toBe(404)
  expect((await as.cust.post(`${u}/respond`).send({ action: 'accept' })).body.status).toBe('offer_accepted')
  expect((await as.staff.patch(u).send({ status: 'paid' })).status).toBe(200)
  expect((await as.admin.patch(u).send({ status: 'completed' })).status).toBe(200)

  const d = (await as.cust.post('/api/tradeins').send(body)).body.reference
  await as.staff.patch(`/api/tradeins/${d}`).send({ status: 'valuation_review', finalOffer: 50 })
  await as.staff.patch(`/api/tradeins/${d}`).send({ status: 'offer_sent' })
  expect((await as.cust.post(`/api/tradeins/${d}/respond`).send({ action: 'decline' })).body.status).toBe('offer_declined')
  const w = (await as.cust.post('/api/tradeins').send(body)).body.reference
  expect((await as.cust.post(`/api/tradeins/${w}/respond`).send({ action: 'cancel' })).body.status).toBe('cancelled')
})

// ---------------------------------------------------------------- loyalty
test('loyalty: adjust, spend at checkout, earn on collection, refund reverses', async () => {
  const id = (await query("SELECT id FROM users WHERE email = 'customer@demo.com'")).rows[0].id
  const start = await balance()
  expect((await as.admin.post('/api/loyalty/adjust').send({ userId: id, delta: 200 })).status, 'note required').toBe(400)
  expect((await as.staff.post('/api/loyalty/adjust').send({ userId: id, delta: 5, note: 'x' })).status).toBe(403)
  expect((await as.admin.post('/api/loyalty/adjust').send({ userId: id, delta: -(start + 1), note: 'too far' })).status, 'never negative').toBe(400)
  await query('UPDATE users SET loyalty_points = 0 WHERE id = $1', [id])
  expect((await as.admin.post('/api/loyalty/adjust').send({ userId: id, delta: 200, note: 'welcome bonus' })).body.balance).toBe(200)

  const r = await order([{ productId: macbook, qty: 1 }], { redeemPoints: 1000 })
  expect(r.body).toMatchObject({ total: 709, loyaltyDiscount: 40 }) // over-asking trimmed to the 200 owned
  expect(await balance()).toBe(0)
  await collect(r.body.reference)
  expect(await balance(), '£709 earns 70 x 5').toBe(350)

  const refunded = await as.staff.patch(`/api/orders/${r.body.reference}/status`).send({ status: 'refunded' })
  expect(refunded.body.paymentStatus).toBe('refunded')
  expect(await balance(), 'earned 350 off, spent 200 back').toBe(200)

  const c = await order([{ productId: macbook, qty: 1 }], { redeemPoints: 100 })
  expect(await balance()).toBe(100)
  await as.cust.post(`/api/orders/${c.body.reference}/cancel`)
  expect(await balance(), 'cancel gives the points back').toBe(200)
})

test('loyalty: a spend of exactly £10 earns nothing; counter redemption on a repair is capped and once only', async () => {
  const id = (await query("SELECT id FROM users WHERE email = 'customer@demo.com'")).rows[0].id
  await query('UPDATE users SET loyalty_points = 300 WHERE id = $1', [id])
  const repair = (await as.cust.post('/api/repairs').send({ branchId: blv, device: { model: 'X' }, problem: 'y', fulfilment: 'in_store' })).body.reference
  const u = `/api/repairs/${repair}`
  expect((await as.staff.post('/api/loyalty/redeem').send({ customerId: id, points: 100, repairRef: repair })).status, 'quote not sent').toBe(400)
  for (const s of ['Device received', 'Diagnostics']) await as.staff.patch(`${u}/status`).send({ status: s })
  await as.staff.patch(`${u}/quote`).send({ quote: 100 })
  await as.staff.patch(`${u}/status`).send({ status: 'Quote awaiting approval' })
  await as.cust.patch(`${u}/status`).send({ status: 'Repair in progress' })
  expect((await as.cust.post('/api/loyalty/redeem').send({ customerId: id, points: 10, billAmount: 50 })).status).toBe(403)
  expect((await as.sidcup.post('/api/loyalty/redeem').send({ customerId: id, points: 100, repairRef: repair })).status, 'other branch').toBe(404)
  expect((await as.staff.get('/api/loyalty/lookup?email=CUSTOMER@demo.com')).body.id).toBe(id)
  const r = await as.staff.post('/api/loyalty/redeem').send({ customerId: id, points: 1000, repairRef: repair })
  expect(r.body).toMatchObject({ points: 100, discount: 20, balance: 200 }) // 20% of £100
  expect((await as.staff.post('/api/loyalty/redeem').send({ customerId: id, points: 10, repairRef: repair })).status).toBe(409)
  const detail = (await as.cust.get(u)).body
  expect([detail.loyaltyDiscount, detail.amountDue]).toEqual([20, 80])
  for (const s of ['Quality check', 'Ready for collection']) await as.staff.patch(`${u}/status`).send({ status: s })
  expect((await as.staff.patch(`${u}/pay`)).body.amountDue).toBe(80)
  await as.staff.patch(`${u}/status`).send({ status: 'Completed' })
  expect(await balance(), '£80 earns 40').toBe(240)

  expect((await as.staff.post('/api/loyalty/redeem').send({ customerId: id, points: 100, billAmount: 9 })).status, 'under £10').toBe(400)
  expect((await as.staff.post('/api/loyalty/redeem').send({ customerId: id, points: 1000, billAmount: 30 })).body).toMatchObject({ points: 30, discount: 6 })
})

test('five simultaneous checkouts spending the same 10 points: spent once', async () => {
  const id = (await query("SELECT id FROM users WHERE email = 'customer@demo.com'")).rows[0].id
  await query('UPDATE users SET loyalty_points = 10 WHERE id = $1', [id])
  const results = await Promise.all([1, 2, 3, 4, 5].map(() => order([{ productId: macbook, qty: 1 }], { redeemPoints: 10 })))
  expect(results.filter((r) => r.body.loyaltyDiscount > 0)).toHaveLength(1)
  expect(await balance()).toBe(0)
})

// ---------------------------------------------------------------- dashboards and the revenue rule
test('revenue counts paid orders only; repair takings are a separate figure', async () => {
  await query("UPDATE orders SET paid_at = paid_at - interval '30 days' WHERE paid_at IS NOT NULL") // clear earlier tests out of "today"
  await query("UPDATE repairs SET paid_at = paid_at - interval '30 days' WHERE paid_at IS NOT NULL")
  const a = (await order([{ productId: cable, qty: 2 }])).body // paid, kept
  const b = (await order([{ productId: cable, qty: 1 }])).body // paid then cancelled
  await order([{ productId: cable, qty: 1 }])                   // never paid
  const d = (await order([{ productId: cable, qty: 1 }])).body // paid, collected, refunded
  for (const o of [a, b, d]) await as.staff.patch(`/api/orders/${o.reference}/pay`)
  await as.cust.post(`/api/orders/${b.reference}/cancel`)
  for (const s of ['processing', 'ready', 'collected', 'refunded']) await as.staff.patch(`/api/orders/${d.reference}/status`).send({ status: s })

  const repair = (await as.cust.post('/api/repairs').send({ branchId: blv, device: { model: 'Z' }, problem: 'y', fulfilment: 'in_store' })).body.reference
  const u = `/api/repairs/${repair}`
  for (const s of ['Device received', 'Diagnostics']) await as.staff.patch(`${u}/status`).send({ status: s })
  await as.staff.patch(`${u}/quote`).send({ quote: 75 })
  await as.staff.patch(`${u}/status`).send({ status: 'Quote awaiting approval' })
  await as.cust.patch(`${u}/status`).send({ status: 'Repair in progress' })
  for (const s of ['Quality check', 'Ready for collection']) await as.staff.patch(`${u}/status`).send({ status: s })
  expect((await as.staff.get('/api/dashboard/stats')).body.repairsAwaitingPayment).toBeGreaterThan(0)
  await as.staff.patch(`${u}/pay`)

  const staff = (await as.staff.get('/api/dashboard/stats')).body
  const today = staff.revenueByDay.at(-1)
  expect(today.revenue, 'only the paid, kept order').toBe(a.total)
  expect(today.repairTakings).toBe(75)
  expect(staff.revenueByDay).toHaveLength(14)
  expect(staff.revenueByBranch).toHaveLength(1)
  expect(staff.revenueByBranch[0]).toMatchObject({ branch: 'Belvedere', revenue: a.total, repairTakings: 75 })

  const admin = (await as.admin.get('/api/dashboard/stats')).body
  expect(admin.revenueByBranch).toHaveLength(8)
  const sidcup = (await as.sidcup.get('/api/dashboard/stats')).body
  expect(sidcup.revenueByDay.every((x) => x.revenue === 0 && x.repairTakings === 0)).toBe(true)
  const cust = (await as.cust.get('/api/dashboard/stats')).body
  expect([cust.role, cust.revenueByDay]).toEqual(['customer', undefined])
  expect((await request(app).get('/api/dashboard/stats')).status).toBe(401)
})

test('low stock is counted per branch', async () => {
  await as.admin.patch(`/api/stock/${cable}`).send({ stock: 1, branchId: sid })
  const own = (await as.sidcup.get('/api/dashboard/stats')).body.lowStock
  const all = (await as.admin.get('/api/dashboard/stats')).body.lowStock
  expect(own).toBeGreaterThanOrEqual(1)
  expect(all).toBeGreaterThanOrEqual(own)
})

// ---------------------------------------------------------------- lists: paging and search
test('lists page, search and report the total in X-Total-Count', async () => {
  const all = await as.staff.get('/api/orders')
  const total = Number(all.headers['x-total-count'])
  expect(total).toBe(all.body.length)
  expect(total).toBeGreaterThan(3)

  const page = await as.staff.get('/api/orders?limit=2&offset=1')
  expect(page.body).toHaveLength(2)
  expect(Number(page.headers['x-total-count'])).toBe(total)
  expect(page.body[0].reference).toBe(all.body[1].reference)

  const byRef = await as.staff.get(`/api/orders?q=${all.body[0].reference.toLowerCase()}`)
  expect(byRef.body.map((o) => o.reference)).toEqual([all.body[0].reference])
  expect((await as.staff.get('/api/orders?q=%25')).body, 'a literal % matches nothing').toEqual([])
  expect((await as.staff.get('/api/orders?status=refunded')).body.every((o) => o.status === 'refunded')).toBe(true)
  expect((await as.staff.get('/api/repairs?q=iphone 13')).body.length).toBeGreaterThan(0)
  expect((await as.staff.get('/api/tradeins?q=iphone 12')).body.length).toBeGreaterThan(0)
  expect((await as.cust.get('/api/orders?limit=100000')).body.length, 'limit is capped, not an error').toBeGreaterThan(0)
})

// ---------------------------------------------------------------- admin user management
test('admin manages staff and customers; resets and deactivation take effect immediately', async () => {
  expect((await as.staff.get('/api/users')).status).toBe(403)
  expect((await as.admin.post('/api/users').send({ name: 'S', email: 'x@test.local', password: PW, role: 'staff' })).status, 'staff need a branch').toBe(400)
  expect((await as.admin.post('/api/users').send({ name: 'S', email: 'x@test.local', password: PW, role: 'admin' })).status, 'no admins via the API').toBe(400)
  expect((await as.admin.post('/api/users').send({ name: 'S', email: 'x@test.local', password: 'short', role: 'customer' })).status).toBe(400)
  expect((await as.admin.post('/api/users').send({ name: 'D', email: 'flows-sidcup@test.local', password: PW, role: 'customer' })).status).toBe(409)

  const adminId = (await query("SELECT id FROM users WHERE email = 'admin@demo.com'")).rows[0].id
  expect((await as.admin.put(`/api/users/${adminId}`).send({ name: 'x' })).status, 'admin accounts are not editable here').toBe(404)
  expect((await as.admin.delete(`/api/users/${adminId}`)).status).toBe(404)

  const id = (await query("SELECT id FROM users WHERE email = 'flows-sidcup@test.local'")).rows[0].id
  expect((await as.admin.put(`/api/users/${id}`).send({ name: 'Flows Lead', phone: '0123' })).body).toMatchObject({ name: 'Flows Lead', branchName: 'Sidcup' })
  expect((await as.admin.put(`/api/users/${id}`).send({ password: '' })).status, 'blank keeps the old password').toBe(200)
  await login('flows-sidcup@test.local')
  expect((await as.admin.put(`/api/users/${id}`).send({ password: 'Reset-Pass-99!' })).status).toBe(200)
  expect((await as.sidcup.get('/api/auth/me')).status, 'a reset ends the old session').toBe(401)
  as.sidcup = await login('flows-sidcup@test.local', 'Reset-Pass-99!')

  expect((await as.admin.delete(`/api/users/${id}`)).status).toBe(200)
  expect((await as.sidcup.get('/api/auth/me')).status, 'deactivated: locked out at once').toBe(401)
  expect((await request(app).post('/api/auth/login').send({ email: 'flows-sidcup@test.local', password: 'Reset-Pass-99!' })).status).toBe(401)
  expect((await as.admin.put(`/api/users/${id}`).send({ active: true })).body.active).toBe(true)

  const search = await as.admin.get('/api/users?role=customer&q=flows-other')
  expect(search.body.map((u) => u.email)).toEqual(['flows-other@test.local'])
  expect(Number(search.headers['x-total-count'])).toBe(1)
})

// ---------------------------------------------------------------- database safety nets
test('the database itself refuses impossible data', async () => {
  const bad = (sql, params = []) => query(sql, params).then(() => 'accepted', (e) => e.code)
  expect(await bad("UPDATE repairs SET status = 'Teleported' WHERE id = (SELECT min(id) FROM repairs)")).toBe('23514')
  expect(await bad("UPDATE orders SET status = 'Teleported' WHERE id = (SELECT min(id) FROM orders)")).toBe('23514')
  expect(await bad('UPDATE branch_stock SET stock = -1 WHERE ctid = (SELECT ctid FROM branch_stock LIMIT 1)')).toBe('23514')
  expect(await bad("INSERT INTO users (name, email, password, role) VALUES ('s', 'nobranch@test.local', 'x', 'staff')")).toBe('23514')
  expect(await bad("INSERT INTO users (name, email, password) VALUES ('s', 'UPPER@test.local', 'x')")).toBe('23514')
})
