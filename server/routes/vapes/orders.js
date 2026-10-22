import { Router } from 'express'
import { query, tx } from '../../db.js'
import { protect, requireRole } from '../../middleware/auth.js'
import { nextVapeReference } from '../../utils/vapeReference.js'
import { findVapeOrders, toVapeOrder } from '../../utils/vapeOrders.js'
import { pageOf, sendPage } from '../../utils/paging.js'
import { fail, wrap } from '../../utils/validate.js'
import { orderTotal } from '../../utils/rules.js'
import { VAPE_STATUS as V, VAPE_STATUSES, VAPE_PAYMENT_METHODS, VAPE_ORDER_LIMITS as L, vapeMoves, vapeCanCancel } from '../../utils/vapeRules.js'

const router = Router()
router.use(protect)

const staffOnly = requireRole('staff', 'admin')
const entry = (req, status, note) => JSON.stringify([{ status, at: new Date().toISOString(), by: req.user.name, ...(note && { note }) }])
const stale = () => fail(409, 'This order was just updated by someone else. Reload and try again.')

// Out-of-scope refs get 404, not 403, so a reference never confirms a stranger's order exists.
async function load(req) {
  const [row] = await findVapeOrders(req.user, { ref: req.params.ref })
  if (!row) throw fail(404, 'Order not found')
  return row
}
const respond = async (req, res, status = 200) => res.status(status).json(toVapeOrder(await load(req), req.user.role))

// Collection only, pay at the counter. The customer must confirm they are 18 or over; staff still check ID on collection.
router.post('/', requireRole('customer'), wrap(async (req, res) => {
  const { items, branchId, paymentMethod, ageConfirmed } = req.body
  if (ageConfirmed !== true) throw fail(400, 'Please confirm you are 18 or over')
  if (!VAPE_PAYMENT_METHODS.includes(paymentMethod)) throw fail(400, 'Choose how you will pay')
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Your basket is empty')
  if (items.length > L.MAX_LINES) throw fail(400, 'Too many different items in one order')

  const wanted = new Map() // ids and quantities only: the server prices them
  for (const i of items) {
    if (!Number.isInteger(i.productId) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > L.MAX_QTY) throw fail(400, 'Invalid basket item')
    wanted.set(i.productId, (wanted.get(i.productId) || 0) + i.qty)
  }
  const { rows: [branch] } = await query('SELECT area FROM branches WHERE id = $1 AND active = true', [branchId])
  if (!branch) throw fail(400, 'Choose a branch')

  const reference = await nextVapeReference('ORD')
  await tx(async (db) => {
    const lines = []
    for (const [productId, qty] of [...wanted].sort((a, b) => a[0] - b[0])) { // fixed lock order avoids deadlocks
      const { rows: [p] } = await db.query(
        `UPDATE vape_stock s SET stock = s.stock - $3 FROM vape_products p
         WHERE s.branch_id = $1 AND s.product_id = $2 AND p.id = s.product_id AND p.active = true AND s.stock >= $3
         RETURNING p.id, p.name, p.flavour, p.nicotine_mg, p.price`, [branchId, productId, qty])
      if (!p) {
        const { rows: [named] } = await db.query('SELECT name FROM vape_products WHERE id = $1 AND active = true', [productId])
        throw fail(409, named ? `Not enough stock for "${named.name}" at ${branch.area}` : 'A product in your basket is no longer available')
      }
      lines.push({ productId: p.id, name: p.name, flavour: p.flavour, nicotineMg: p.nicotine_mg, price: p.price, qty })
    }
    await db.query(
      `INSERT INTO vape_orders (reference, customer_id, branch_id, items, total, payment_method, age_confirmed, history)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
      [reference, req.user.id, branchId, JSON.stringify(lines), orderTotal(lines), paymentMethod, entry(req, V.PENDING)])
  })
  req.params.ref = reference
  await respond(req, res, 201)
}))

router.get('/', wrap(async (req, res) => {
  const status = VAPE_STATUSES.includes(req.query.status) ? req.query.status : undefined
  sendPage(res, await findVapeOrders(req.user, { status, q: req.query.q, ...pageOf(req) }), (o) => toVapeOrder(o, req.user.role))
}))
router.get('/:ref', wrap(async (req, res) => respond(req, res)))

router.patch('/:ref/status', staffOnly, wrap(async (req, res) => {
  const order = await load(req)
  const to = req.body.status
  if (!vapeMoves({ status: order.status, paymentStatus: order.payment_status }).includes(to)) {
    throw fail(400, `An order cannot move from "${order.status}" to "${to}"`)
  }
  const { rowCount } = await query( // matching the old status makes two simultaneous updates safe
    `UPDATE vape_orders SET status = $1, history = history || $2::jsonb, updated_at = now(),
       payment_status = CASE WHEN $1 = 'refunded' THEN 'refunded' ELSE payment_status END
     WHERE reference = $3 AND status = $4`, [to, entry(req, to), order.reference, order.status])
  if (!rowCount) throw stale()
  await respond(req, res)
}))

router.patch('/:ref/pay', staffOnly, wrap(async (req, res) => {
  const order = await load(req)
  if (order.payment_status !== 'unpaid' || order.status === V.CANCELLED) throw fail(400, 'This order cannot be marked as paid')
  const { rowCount } = await query(
    `UPDATE vape_orders SET payment_status = 'paid', paid_at = now(), history = history || $1::jsonb, updated_at = now()
     WHERE reference = $2 AND payment_status = 'unpaid' AND status = $3`,
    [entry(req, order.status, 'Marked as paid'), order.reference, order.status])
  if (!rowCount) throw stale()
  await respond(req, res)
}))

// Customer (own), staff (branch) and admin all use this; the scope filter in load() decides whose.
router.post('/:ref/cancel', wrap(async (req, res) => {
  const order = await load(req)
  if (!vapeCanCancel(order.status)) throw fail(400, 'This order can no longer be cancelled')
  await tx(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE vape_orders SET status = 'cancelled', history = history || $1::jsonb, updated_at = now(),
         payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE reference = $2 AND status = $3`, [entry(req, V.CANCELLED), order.reference, order.status])
    if (!rowCount) throw stale()
    for (const i of order.items) { // back into the stock of the branch that held it
      await db.query(
        `INSERT INTO vape_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
         ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = vape_stock.stock + EXCLUDED.stock`, [order.branch_id, i.productId, i.qty])
    }
  })
  await respond(req, res)
}))

export default router
