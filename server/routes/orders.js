import { Router } from 'express'
import { query, tx } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { nextReference } from '../utils/reference.js'
import { postLoyalty, awardOrderPoints, reverseOrderPoints } from '../utils/loyalty.js'
import { findOrders, toOrder } from '../utils/orders.js'
import { pageOf, sendPage } from '../utils/paging.js'
import { fail, str, wrap } from '../utils/validate.js'
import {
  ORDER_STATUS as O, DELIVERY_METHODS, PAYMENT_METHODS, orderMoves, orderCanCancel, orderTotal, redemption, pointsForDiscount,
} from '../utils/rules.js'

const router = Router()
router.use(protect)

const staffOnly = requireRole('staff', 'admin')
const entry = (req, status, note) => JSON.stringify([{ status, at: new Date().toISOString(), by: req.user.name, ...(note && { note }) }])
const stale = () => fail(409, 'This order was just updated by someone else. Reload and try again.')

// Out-of-scope refs get 404, not 403, so a reference never confirms a stranger's order exists.
async function load(req) {
  const [row] = await findOrders(req.user, { ref: req.params.ref })
  if (!row) throw fail(404, 'Order not found')
  return row
}
const respond = async (req, res, status = 200) => res.status(status).json(toOrder(await load(req), req.user.role))

router.post('/', requireRole('customer'), wrap(async (req, res) => {
  const { items, branchId, deliveryMethod, paymentMethod, address } = req.body
  if (!DELIVERY_METHODS.includes(deliveryMethod)) throw fail(400, 'Choose collection or delivery')
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw fail(400, 'Choose how you will pay')
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Your basket is empty')
  if (items.length > 50) throw fail(400, 'Too many different items in one order')

  // Merge repeated products; the client sends ids and quantities only, never prices.
  const wanted = new Map()
  for (const i of items) {
    if (!Number.isInteger(i.productId) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99) throw fail(400, 'Invalid basket item')
    wanted.set(i.productId, (wanted.get(i.productId) || 0) + i.qty)
  }
  const addr = deliveryMethod === 'delivery'
    ? {
        line1: str(address?.line1, { max: 200, label: 'Address line 1' }),
        city: str(address?.city, { max: 100, label: 'City' }),
        postcode: str(address?.postcode, { max: 12, label: 'Postcode' }),
      }
    : null
  if (addr && !(addr.line1 && addr.city && addr.postcode)) throw fail(400, 'Enter your full delivery address')
  const { rows: [branch] } = await query('SELECT area FROM branches WHERE id = $1 AND active = true', [branchId])
  if (!branch) throw fail(400, 'Choose a branch')

  const reference = await nextReference('ORD')
  // One transaction: if any item is short at this branch, nothing is taken and no order exists.
  await tx(async (db) => {
    const lines = []
    for (const [productId, qty] of [...wanted].sort((a, b) => a[0] - b[0])) { // fixed lock order avoids deadlocks
      const { rows: [p] } = await db.query(
        `UPDATE branch_stock s SET stock = s.stock - $3 FROM products p
         WHERE s.branch_id = $1 AND s.product_id = $2 AND p.id = s.product_id AND p.active = true AND s.stock >= $3
         RETURNING p.id, p.name, p.price`, [branchId, productId, qty])
      if (!p) {
        const { rows: [named] } = await db.query('SELECT name FROM products WHERE id = $1 AND active = true', [productId])
        throw fail(409, named ? `Not enough stock for "${named.name}" at ${branch.area}` : 'A product in your basket is no longer available')
      }
      lines.push({ productId: p.id, name: p.name, price: p.price, qty })
    }
    // Redeeming happens here, in the same transaction as the order, so there is no half-done state.
    const subtotal = orderTotal(lines)
    const { rows: [me] } = await db.query('SELECT loyalty_points FROM users WHERE id = $1 FOR UPDATE', [req.user.id])
    const { points, discount } = redemption({ requested: req.body.redeemPoints, balance: me.loyalty_points, bill: subtotal })
    if (points) await postLoyalty(db, req.user.id, -points, 'redeemed', reference, 'Used at checkout')
    await db.query(
      `INSERT INTO orders (reference, customer_id, branch_id, items, total, loyalty_discount, delivery_method, address, payment_method, history)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [reference, req.user.id, branchId, JSON.stringify(lines), Math.round((subtotal - discount) * 100) / 100, discount, deliveryMethod,
        addr && JSON.stringify(addr), paymentMethod, entry(req, O.PENDING)])
  })
  req.params.ref = reference
  await respond(req, res, 201)
}))

// ?status=&q=&limit=&offset= ; the full match count comes back in X-Total-Count.
router.get('/', wrap(async (req, res) => {
  const status = Object.values(O).includes(req.query.status) ? req.query.status : undefined
  const rows = await findOrders(req.user, { status, q: req.query.q, ...pageOf(req) })
  sendPage(res, rows, (o) => toOrder(o, req.user.role))
}))
router.get('/:ref', wrap(respond))

router.patch('/:ref/status', staffOnly, wrap(async (req, res) => {
  const order = await load(req)
  const to = req.body.status
  if (!orderMoves({ status: order.status, deliveryMethod: order.delivery_method, paymentStatus: order.payment_status }).includes(to)) {
    throw fail(400, `An order cannot move from "${order.status}" to "${to}"`)
  }
  // Matching on the old status makes two simultaneous updates safe.
  await tx(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE orders SET status = $1, history = history || $2::jsonb, updated_at = now(),
         payment_status = CASE WHEN $1 = 'refunded' THEN 'refunded' ELSE payment_status END
       WHERE reference = $3 AND status = $4`,
      [to, entry(req, to), order.reference, order.status])
    if (!rowCount) throw stale()
    if (to === O.DELIVERED || to === O.COLLECTED) await awardOrderPoints(db, order.reference)
    if (to === O.REFUNDED) await reverseOrderPoints(db, order)
  })
  await respond(req, res)
}))

router.patch('/:ref/pay', staffOnly, wrap(async (req, res) => {
  const order = await load(req)
  if (order.payment_status !== 'unpaid' || order.status === O.CANCELLED) throw fail(400, 'This order cannot be marked as paid')
  const next = order.status === O.PENDING ? O.PAID : order.status // pending -> paid; later stages keep their status
  const { rowCount } = await query(
    `UPDATE orders SET payment_status = 'paid', paid_at = now(), status = $1, history = history || $2::jsonb, updated_at = now()
     WHERE reference = $3 AND payment_status = 'unpaid' AND status = $4`,
    [next, entry(req, next, 'Marked as paid'), order.reference, order.status])
  if (!rowCount) throw stale()
  await respond(req, res)
}))

// Customer (own), staff (branch) and admin all use this; the scope filter in load() decides whose.
router.post('/:ref/cancel', wrap(async (req, res) => {
  const order = await load(req)
  if (!orderCanCancel(order.status)) throw fail(400, 'This order can no longer be cancelled')
  await tx(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE orders SET status = 'cancelled', history = history || $1::jsonb, updated_at = now(),
         payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE reference = $2 AND status = $3`,
      [entry(req, O.CANCELLED), order.reference, order.status])
    if (!rowCount) throw stale()
    // Back into the stock of the branch that held it.
    for (const i of order.items) {
      await db.query(
        `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
         ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock`,
        [order.branch_id, i.productId, i.qty])
    }
    // Points spent at checkout come back with the cancelled order.
    if (order.loyalty_discount > 0) {
      await postLoyalty(db, order.customer_id, pointsForDiscount(order.loyalty_discount), 'adjusted', order.reference, 'Refund: order cancelled')
    }
  })
  await respond(req, res)
}))

export default router
