import { signInAtBranch } from '../utils/branchByIp.js'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { query, tx } from '../db.js'
import { protectTill, requireRole } from '../middleware/auth.js'
import { pinLimiter } from '../middleware/limits.js'
import { config } from '../config.js'
import { startShift, endShift, needShift } from '../utils/shifts.js'
import { setCookie } from '../utils/session.js'
import { nextReference } from '../utils/reference.js'
import { nextVapeReference } from '../utils/vapeReference.js'
import { pageOf, likeOf } from '../utils/paging.js'
import { fail, wrap } from '../utils/validate.js'
import { PAYMENT_METHODS, orderTotal } from '../utils/rules.js'
import { WALK_IN_EMAIL } from '../utils/users.js'

// Counter sales for the signed-in staff member's own branch. Prices come from the database, never the request.
// The till has its own sign-in and cookie (path /api/till, 12 hours), so whoever sits at it can never reach a dashboard,
// hours or wages. Staff sign in with their PIN; "Switch person" signs out of the till only and ends no shift.
const router = Router()

const TILL_COOKIE = { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/api/till' }
const staffByPin = async (pin) => {
  const { rows } = await query("SELECT * FROM users WHERE pin = $1 AND role = 'staff' AND active", [String(pin ?? '')])
  return rows[0]
}
// pv ties the token to the account's last PIN/password change, as the dashboard cookie does.
const setTillCookie = (res, user) => {
  const token = jwt.sign({ id: user.id, pv: user.password_changed_at?.getTime() ?? 0 }, process.env.JWT_SECRET, { expiresIn: '12h' })
  res.cookie('till_token', token, TILL_COOKIE) // session cookie: the browser closing signs the till out
}
const who = (u) => ({ id: u.id, name: u.name, branchId: u.branch_id })

router.post('/login', pinLimiter, wrap(async (req, res) => {
  const user = await staffByPin(req.body.pin)
  if (!user) throw fail(401, 'Wrong PIN')
  const here = await signInAtBranch(req, user)
  setTillCookie(res, here)
  res.json(who(here))
}))

router.post('/logout', (req, res) => {
  res.clearCookie('till_token', TILL_COOKIE)
  res.json({ ok: true })
})

router.use(protectTill, requireRole('staff'))

// The person already proved who they are with their PIN, so "Stock & deliveries" opens their staff dashboard without a
// second PIN. Same account, same rules; hours and wages stay admin-only. One-way: a dashboard session never opens the till.
router.post('/open-dashboard', (req, res) => { setCookie(res, req.user); res.json({ ok: true }) })

router.get('/me', wrap(async (req, res) => {
  const { rows: [b] } = await query('SELECT area FROM branches WHERE id = $1', [req.user.branch_id])
  const { rows: [shift] } = await query('SELECT 1 AS open FROM shifts WHERE user_id = $1 AND ended_at IS NULL', [req.user.id])
  res.json({ ...who(req.user), branchName: b?.area, onShift: !!shift })
}))

// Everyone at this branch and whether they are on shift: names only, never times or pay.
router.get('/crew', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, EXISTS (SELECT 1 FROM shifts s WHERE s.user_id = u.id AND s.ended_at IS NULL) AS "onShift"
     FROM users u WHERE u.role = 'staff' AND u.active AND u.branch_id = $1 ORDER BY u.name`, [req.user.branch_id])
  res.json(rows)
}))

router.post('/shift/start', wrap(async (req, res) => { await startShift(req.user); res.status(201).json({ ok: true }) }))
router.post('/shift/end', wrap(async (req, res) => { await endShift(req.user.id); res.json({ ok: true }) }))

// Clock someone in or out with their own PIN, from this till. Only people from this branch.
router.post('/clock', pinLimiter, wrap(async (req, res) => {
  if (!['start', 'end', 'toggle'].includes(req.body.action)) throw fail(400, 'Choose start or end')
  const person = await staffByPin(req.body.pin)
  if (!person) throw fail(401, 'Wrong PIN')
  if (person.branch_id !== req.user.branch_id) throw fail(403, 'That person works at another branch')
  let action = req.body.action
  if (action === 'toggle') { // the keypad has no Start/End buttons: on shift means end, otherwise start
    action = (await query('SELECT 1 FROM shifts WHERE user_id = $1 AND ended_at IS NULL', [person.id])).rowCount ? 'end' : 'start'
  }
  await (action === 'start' ? startShift(person) : endShift(person.id))
  // The till stays open while anyone is on shift: if the person holding it just left, it passes to the one who has been on longest.
  let holder = req.user
  if (!(await query('SELECT 1 FROM shifts WHERE user_id = $1 AND ended_at IS NULL', [holder.id])).rowCount) {
    const { rows: [next] } = await query(
      `SELECT u.* FROM shifts s JOIN users u ON u.id = s.user_id
       WHERE s.ended_at IS NULL AND s.branch_id = $1 AND u.active ORDER BY s.started_at LIMIT 1`, [req.user.branch_id])
    if (next) { setTillCookie(res, next); holder = next }
  }
  res.json({ name: person.name, action, holder: { id: holder.id, name: holder.name } })
}))

const KINDS = ['electronics', 'vape']
const TODAY = "(paid_at AT TIME ZONE 'Europe/London')::date = (now() AT TIME ZONE 'Europe/London')::date"
const entry = (req, status, note) => JSON.stringify([{ status, at: new Date().toISOString(), by: req.user.name, note }])

// ?q=&kind=electronics|vape  Both ranges in one list, stock is this branch's. In stock first, then by name.
router.get('/items', wrap(async (req, res) => {
  const { limit, offset } = pageOf(req, { def: 60, max: 200 })
  const { rows } = await query(
    `SELECT *, count(*) OVER() AS total_count FROM (
       SELECT 'electronics' AS kind, p.id, p.name, concat_ws(' · ', p.brand, p.condition) AS detail, p.price, COALESCE(s.stock, 0)::int AS stock, p.barcode
       FROM products p LEFT JOIN branch_stock s ON s.product_id = p.id AND s.branch_id = $1 WHERE p.active
       UNION ALL
       SELECT 'vape', p.id, b.name || ' ' || p.name, concat_ws(' · ', p.flavour, p.nicotine_mg::text || 'mg'), p.price, COALESCE(s.stock, 0)::int, p.barcode
       FROM vape_products p JOIN vape_brands b ON b.id = p.brand_id LEFT JOIN vape_stock s ON s.product_id = p.id AND s.branch_id = $1 WHERE p.active
     ) i
     WHERE ($2::text IS NULL OR i.name ILIKE $2 OR i.detail ILIKE $2 OR i.barcode = $6::text) AND ($3::text IS NULL OR i.kind = $3)
     ORDER BY (i.stock > 0) DESC, i.name LIMIT $4 OFFSET $5`,
    [req.user.branch_id, req.query.q ? likeOf(req.query.q) : null, KINDS.includes(req.query.kind) ? req.query.kind : null, limit, offset, req.query.q ? String(req.query.q).trim() : null]) // a scanned code matches exactly
  res.set('X-Total-Count', String(rows[0]?.total_count ?? 0))
  res.json(rows.map(({ total_count, ...r }) => ({ ...r, price: Number(r.price) })))
}))

// Takes stock for one range inside the sale's transaction; returns the receipt lines. Short stock aborts the whole sale.
async function takeLines(db, req, kind, wanted) {
  const vape = kind === 'vape'
  const lines = []
  for (const [productId, qty] of [...wanted].sort((a, b) => a[0] - b[0])) { // fixed lock order avoids deadlocks
    const { rows: [p] } = await db.query(
      vape
        ? `UPDATE vape_stock s SET stock = s.stock - $3 FROM vape_products p
           WHERE s.branch_id = $1 AND s.product_id = $2 AND p.id = s.product_id AND p.active AND s.stock >= $3
           RETURNING p.id, p.name, p.flavour, p.nicotine_mg, p.price`
        : `UPDATE branch_stock s SET stock = s.stock - $3 FROM products p
           WHERE s.branch_id = $1 AND s.product_id = $2 AND p.id = s.product_id AND p.active AND s.stock >= $3
           RETURNING p.id, p.name, p.price`,
      [req.user.branch_id, productId, qty])
    if (!p) {
      const { rows: [named] } = await db.query(`SELECT name FROM ${vape ? 'vape_products' : 'products'} WHERE id = $1 AND active`, [productId])
      throw fail(409, named ? `Not enough stock for "${named.name}"` : 'An item is no longer available')
    }
    lines.push(vape
      ? { productId: p.id, name: p.name, flavour: p.flavour, nicotineMg: p.nicotine_mg, price: p.price, qty }
      : { productId: p.id, name: p.name, price: p.price, qty })
  }
  return lines
}

// { items: [{ kind, productId, qty }], paymentMethod, idChecked }
router.post('/sales', needShift, wrap(async (req, res) => {
  const { items, paymentMethod, idChecked } = req.body
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw fail(400, 'Choose cash or card')
  if (!Array.isArray(items) || !items.length) throw fail(400, 'The basket is empty')
  if (items.length > 50) throw fail(400, 'Too many different items in one sale')

  const wanted = { electronics: new Map(), vape: new Map() }
  for (const i of items) {
    if (!KINDS.includes(i.kind) || !Number.isInteger(i.productId) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99) throw fail(400, 'Invalid item in the basket')
    wanted[i.kind].set(i.productId, (wanted[i.kind].get(i.productId) || 0) + i.qty)
  }
  if (wanted.vape.size && idChecked !== true) throw fail(400, 'Check ID and confirm the customer is 18 or over')

  const { rows: [walkIn] } = await query('SELECT id FROM users WHERE email = $1', [WALK_IN_EMAIL])
  const sale = await tx(async (db) => {
    const out = { electronics: null, vape: null }
    for (const kind of KINDS) {
      if (!wanted[kind].size) continue
      const vape = kind === 'vape'
      const lines = await takeLines(db, req, kind, wanted[kind])
      const reference = await (vape ? nextVapeReference('ORD') : nextReference('ORD'))
      const total = orderTotal(lines)
      await db.query(
        vape
          ? `INSERT INTO vape_orders (reference, customer_id, branch_id, items, total, payment_method, payment_status, status, age_confirmed, history, paid_at, sold_by)
             VALUES ($1, $2, $3, $4, $5, $6, 'paid', 'collected', true, $7, now(), $8)`
          : `INSERT INTO orders (reference, customer_id, branch_id, items, total, delivery_method, payment_method, payment_status, status, history, paid_at, sold_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', 'collected', $8, now(), $9)`,
        vape
          ? [reference, walkIn.id, req.user.branch_id, JSON.stringify(lines), total, paymentMethod, entry(req, 'collected', 'Till sale'), req.user.id]
          : [reference, walkIn.id, req.user.branch_id, JSON.stringify(lines), total, 'collection', paymentMethod, entry(req, 'collected', 'Till sale'), req.user.id])
      out[kind] = { reference, lines, total }
    }
    return out
  })
  // Two separate totals on purpose: vape money is never added into electronics figures. The receipt just shows both.
  const total = Math.round(((sale.electronics?.total ?? 0) + (sale.vape?.total ?? 0)) * 100) / 100
  res.status(201).json({ ...sale, total, paymentMethod, at: new Date(), staff: req.user.name })
}))

// This staff member's sales today, newest first, and the takings.
router.get('/today', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM (
       SELECT 'electronics' AS kind, reference, total, payment_method, status, paid_at, items FROM orders WHERE sold_by = $1 AND ${TODAY}
       UNION ALL
       SELECT 'vape', reference, total, payment_method, status, paid_at, items FROM vape_orders WHERE sold_by = $1 AND ${TODAY}
     ) s ORDER BY paid_at DESC LIMIT 200`, [req.user.id])
  const sum = { count: 0, cash: 0, card: 0, electronics: 0, vape: 0 }
  for (const s of rows.filter((r) => r.status === 'collected')) { // voided sales are listed but not counted
    const pence = Math.round(Number(s.total) * 100)
    sum.count += 1
    sum[s.payment_method === 'cash' ? 'cash' : 'card'] += pence
    sum[s.kind] += pence
  }
  for (const k of ['cash', 'card', 'electronics', 'vape']) sum[k] /= 100
  res.json({ summary: sum, sales: rows.map((s) => ({ ...s, total: Number(s.total), voidable: s.status === 'collected' })) })
}))

// Undo a mistaken sale from today: marks it cancelled and refunded, and puts the stock back.
router.post('/sales/:ref/void', wrap(async (req, res) => {
  const vape = req.params.ref.startsWith('VP-')
  await tx(async (db) => {
    const { rows: [sale] } = await db.query(
      `UPDATE ${vape ? 'vape_orders' : 'orders'} SET status = 'cancelled', payment_status = 'refunded',
         history = history || $1::jsonb, updated_at = now()
       WHERE reference = $2 AND sold_by = $3 AND branch_id = $4 AND status = 'collected' AND ${TODAY}
       RETURNING items`, [entry(req, 'cancelled', 'Till sale voided'), req.params.ref, req.user.id, req.user.branch_id])
    if (!sale) throw fail(404, 'Only your own sales from today that are still complete can be voided')
    for (const i of sale.items) {
      await db.query(
        `INSERT INTO ${vape ? 'vape_stock' : 'branch_stock'} (branch_id, product_id, stock) VALUES ($1, $2, $3)
         ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = ${vape ? 'vape_stock' : 'branch_stock'}.stock + EXCLUDED.stock`,
        [req.user.branch_id, i.productId, i.qty])
    }
  })
  res.json({ ok: true })
}))

export default router
