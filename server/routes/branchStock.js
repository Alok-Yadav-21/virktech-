import { Router } from 'express'
import { query, tx } from '../db.js'
import { likeOf, pageOf } from '../utils/paging.js'
import { VAPE_KINDS } from '../utils/vapeRules.js'
import { fail, str, wrap } from '../utils/validate.js'
import { stockDeltas, DELIVERY_LIMITS as L } from '../utils/rules.js'
import { toDelivery, itemsOf, findDeliveries, checkProducts, applyDeltas, receiveDelivery } from '../utils/deliveries.js'
import { findVapeDeliveries, vapeItemsOf, checkVapeProducts, applyVapeDeltas, receiveVapeDelivery } from '../utils/vapeDeliveries.js'

// Mounted at /api/branch (staff dashboard sign-in). Stock and deliveries for the signed-in person's own branch only:
// the branch always comes from req.user, never from the request. Deliveries are listed for today only; the full history
// stays with admin. Admin uses the normal /stock and /deliveries pages, which can pick any branch.
const router = Router()

// Everything that differs between the two ranges. Table names come from here only, never from the request.
const RANGE = {
  electronics: {
    table: 'products', from: 'products p', name: 'p.name', detail: "concat_ws(' · ', p.brand, p.condition)",
    sub: 'p.category_id', stock: 'branch_stock', items: 'delivery_items', head: 'deliveries',
    find: findDeliveries, itemsOf, receive: receiveDelivery, apply: applyDeltas, check: checkProducts,
  },
  vape: {
    table: 'vape_products', from: 'vape_products p JOIN vape_brands b ON b.id = p.brand_id', name: "b.name || ' ' || p.name",
    detail: "concat_ws(' · ', p.flavour, p.nicotine_mg::text || 'mg')",
    sub: 'p.kind', stock: 'vape_stock', items: 'vape_delivery_items', head: 'vape_deliveries',
    find: findVapeDeliveries, itemsOf: vapeItemsOf, receive: receiveVapeDelivery, apply: applyVapeDeltas, check: checkVapeProducts,
  },
}
function rangeOf(kind) {
  if (!Object.hasOwn(RANGE, kind)) throw fail(400, 'Choose electronics or vapes') // hasOwn: 'constructor' must not match
  return RANGE[kind]
}
const codeOf = (v) => str(v, { max: 64, label: 'The code', required: true })

// One product by its scanned code (column p.barcode) or by id (column p.id), with this branch's stock and what this branch
// last paid for it. lastCost comes from this branch's own deliveries only, never from the admin-only bought-for price.
async function findOne(kind, column, value, branchId) {
  const r = RANGE[kind]
  const { rows: [p] } = await query(
    `SELECT p.id, ${r.name} AS name, ${r.detail} AS detail, p.price, COALESCE(s.stock, 0)::int AS stock,
       (SELECT i.unit_cost FROM ${r.items} i JOIN ${r.head} d ON d.id = i.delivery_id
         WHERE d.branch_id = $2 AND i.product_id = p.id ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS "lastCost"
     FROM ${r.from} LEFT JOIN ${r.stock} s ON s.product_id = p.id AND s.branch_id = $2
     WHERE ${column} = $1 AND p.active`, [value, branchId])
  return p ? { kind, ...p } : null
}

const findByCode = (kind, code, branchId) => findOne(kind, 'p.barcode', code, branchId)

// ?kind=&sub=&q=  The tiles on the stock screens: one range, optionally one sub-category (electronics: category id,
// vapes: type such as 'Coil'), with this branch's stock and the photo.
router.get('/items', wrap(async (req, res) => {
  const r = rangeOf(req.query.kind)
  const sub = req.query.sub
  if (sub && r.table === 'products' && !Number.isInteger(+sub)) throw fail(400, 'Choose a category from the list')
  if (sub && r.table === 'vape_products' && !VAPE_KINDS.includes(sub)) throw fail(400, 'Choose a type from the list')
  const { limit, offset } = pageOf(req, { def: 60, max: 200 })
  const { rows } = await query(
    `SELECT p.id, ${r.name} AS name, ${r.detail} AS detail, p.image, p.barcode, COALESCE(s.stock, 0)::int AS stock
     FROM ${r.from} LEFT JOIN ${r.stock} s ON s.product_id = p.id AND s.branch_id = $1
     WHERE p.active AND ($2::text IS NULL OR ${r.sub}::text = $2::text) AND ($3::text IS NULL OR ${r.name} ILIKE $3 OR p.barcode = $4)
     ORDER BY ${r.name} LIMIT $5 OFFSET $6`,
    [req.user.branch_id, sub || null, req.query.q ? likeOf(req.query.q) : null, String(req.query.q || '').trim(), limit, offset])
  res.json(rows)
}))

// ?code=  searches both ranges.  ?kind=&id=  is the same answer for a product the person tapped instead of scanned.
router.get('/lookup', wrap(async (req, res) => {
  if (req.query.id !== undefined) {
    rangeOf(req.query.kind)
    const found = Number.isInteger(+req.query.id) && (await findOne(req.query.kind, 'p.id', +req.query.id, req.user.branch_id))
    if (!found) throw fail(404, 'Product not found')
    return res.json(found)
  }
  const code = codeOf(req.query.code)
  for (const kind of Object.keys(RANGE)) {
    const found = await findByCode(kind, code, req.user.branch_id)
    if (found) return res.json(found)
  }
  throw fail(404, 'Unknown code')
}))

// Link a code to a product that has none yet (the "unknown code, pick the product" flow). A code belongs to one product
// across both ranges; changing a code that is already set is left to admin.
router.post('/barcode', wrap(async (req, res) => {
  const r = rangeOf(req.body.kind)
  const code = codeOf(req.body.code)
  if (!Number.isInteger(req.body.productId)) throw fail(400, 'Choose a product')
  const taken = await query('SELECT 1 FROM products WHERE barcode = $1 UNION ALL SELECT 1 FROM vape_products WHERE barcode = $1', [code])
  if (taken.rowCount) throw fail(409, 'That code is already linked to a product')
  const { rowCount } = await query(
    `UPDATE ${r.table} SET barcode = $1 WHERE id = $2 AND active AND (barcode IS NULL OR barcode = '')`, [code, req.body.productId])
  if (!rowCount) throw fail(409, 'That product was not found or already has a code. An admin can change it.')
  res.status(201).json(await findByCode(req.body.kind, code, req.user.branch_id))
}))

// { kind, items: [{ productId, qty }] }  Adds pieces to this branch's stock, all or nothing (no delivery record).
router.post('/stock/add', wrap(async (req, res) => {
  const r = rangeOf(req.body.kind)
  const { items } = req.body
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Scan or choose at least one product')
  if (items.length > L.MAX_LINES) throw fail(400, `Add ${L.MAX_LINES} products at most at once`)
  const seen = new Set()
  for (const i of items) {
    if (!Number.isInteger(i?.productId) || seen.has(i.productId)) throw fail(400, 'Each product can appear once')
    seen.add(i.productId)
    if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > L.MAX_QTY) throw fail(400, `Quantity must be a whole number from 1 to ${L.MAX_QTY}`)
  }
  await r.check(items)
  await tx((db) => r.apply(db, req.user.branch_id, stockDeltas([], items)))
  res.status(201).json({ ok: true, units: items.reduce((n, i) => n + i.qty, 0) })
}))

// ?kind=  Today's deliveries at this branch, newest first, each with its lines.
router.get('/deliveries', wrap(async (req, res) => {
  const r = rangeOf(req.query.kind)
  const rows = await r.find(req.user, { today: true })
  res.json(await Promise.all(rows.map(async (d) => ({ ...toDelivery(d), items: await r.itemsOf(d.id) }))))
}))

// { kind, supplier, note, items: [{ productId, qty, unitCost }] }  Same checks and stock booking as the dashboard route.
router.post('/deliveries', wrap(async (req, res) => {
  const r = rangeOf(req.body.kind)
  const id = await r.receive(req.user, req.user.branch_id, req.body)
  const [row] = await r.find(req.user, { id })
  res.status(201).json({ ...toDelivery(row), items: await r.itemsOf(id) })
}))

export default router
