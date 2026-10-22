import { query } from '../db.js'
import { scopeClause } from './scope.js'
import { fail, str } from './validate.js'
import { likeOf } from './paging.js'
import { DELIVERY_LIMITS as L, lineCost } from './rules.js'

const SELECT = `
  SELECT d.id, d.reference, d.supplier, d.branch_id, to_char(d.received_on, 'YYYY-MM-DD') AS received_on, d.note, d.created_at,
         b.area AS branch_area, u.name AS created_by_name,
         COALESCE(t.units, 0)::int AS units, COALESCE(t.cost, 0) AS cost, COALESCE(t.lines, 0)::int AS lines,
         count(*) OVER() AS total_count
  FROM deliveries d
  JOIN branches b ON b.id = d.branch_id
  LEFT JOIN users u ON u.id = d.created_by
  LEFT JOIN (SELECT delivery_id, sum(qty) AS units, sum(qty * unit_cost) AS cost, count(*) AS lines
             FROM delivery_items GROUP BY delivery_id) t ON t.delivery_id = d.id`

// Scoped read, like findOrders: staff only ever see their own branch's deliveries.
export async function findDeliveries(user, { id, q, limit = 100, offset = 0 } = {}) {
  const scope = scopeClause(user, { branch: 'd.branch_id' })
  const where = [scope.sql]
  const params = [...scope.params]
  if (id) { params.push(id); where.push(`d.id = $${params.length}`) }
  if (q) {
    params.push(likeOf(q))
    where.push(`(d.reference ILIKE $${params.length} OR d.supplier ILIKE $${params.length})`)
  }
  params.push(limit, offset)
  const { rows } = await query(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY d.received_on DESC, d.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
  return rows
}

export const toDelivery = (d) => ({
  id: d.id, reference: d.reference, supplier: d.supplier, receivedOn: d.received_on, note: d.note,
  branch: { id: d.branch_id, area: d.branch_area }, createdBy: d.created_by_name,
  units: d.units, lines: d.lines, totalCost: Number(d.cost), createdAt: d.created_at,
})

export async function itemsOf(deliveryId, db = { query }) {
  const { rows } = await db.query(
    `SELECT i.product_id AS "productId", p.name, i.qty, i.unit_cost AS "unitCost", p.price AS "sellPrice"
     FROM delivery_items i JOIN products p ON p.id = i.product_id WHERE i.delivery_id = $1 ORDER BY p.name`, [deliveryId])
  return rows.map((r) => ({ ...r, unitCost: Number(r.unitCost), sellPrice: Number(r.sellPrice), lineCost: lineCost(r.qty, r.unitCost) }))
}

// ---- Validation: the client sends ids, quantities and costs only ----
export function readHead(body) {
  const on = body.receivedOn ?? new Date().toISOString().slice(0, 10)
  if (typeof on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(on) || new Date(`${on}T00:00:00Z`).toISOString().slice(0, 10) !== on) throw fail(400, 'Enter a valid delivery date')
  if (on > new Date(Date.now() + 864e5).toISOString().slice(0, 10)) throw fail(400, 'The delivery date cannot be in the future')
  return {
    supplier: str(body.supplier, { max: 120, label: 'Supplier', required: true }),
    note: str(body.note, { max: 500, label: 'Note' }) || null,
    receivedOn: on,
  }
}

export function readItems(items) {
  if (!Array.isArray(items) || !items.length) throw fail(400, 'Add at least one product')
  if (items.length > L.MAX_LINES) throw fail(400, `A delivery can have ${L.MAX_LINES} products at most`)
  const seen = new Set()
  return items.map((i) => {
    if (!Number.isInteger(i?.productId)) throw fail(400, 'Choose a product on every line')
    if (seen.has(i.productId)) throw fail(400, 'Each product can appear once; add the quantities together')
    seen.add(i.productId)
    if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > L.MAX_QTY) throw fail(400, `Quantity must be a whole number from 1 to ${L.MAX_QTY}`)
    const cost = Number(i.unitCost)
    if (i.unitCost === '' || i.unitCost == null || !Number.isFinite(cost) || cost < 0 || cost > L.MAX_UNIT_COST) throw fail(400, 'Enter what you paid for one piece (0 or more)')
    return { productId: i.productId, qty: i.qty, unitCost: Math.round(cost * 100) / 100 }
  })
}

export async function checkProducts(items) {
  const ids = items.map((i) => i.productId)
  const { rowCount } = await query('SELECT 1 FROM products WHERE id = ANY($1::int[])', [ids])
  if (rowCount !== ids.length) throw fail(400, 'One of the products no longer exists')
}

// Moves one branch's stock up or down. Going below zero means those pieces were already sold, so refuse.
async function moveStock(db, branchId, productId, delta) {
  const refuse = () => fail(409, 'Some of this stock has already been sold, so the delivery cannot be reduced or removed that far')
  if (delta > 0) {
    await db.query(
      `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = branch_stock.stock + EXCLUDED.stock`, [branchId, productId, delta])
    return
  }
  try {
    const { rowCount } = await db.query('UPDATE branch_stock SET stock = stock + $3 WHERE branch_id = $1 AND product_id = $2', [branchId, productId, delta])
    if (!rowCount) throw refuse()
  } catch (e) {
    throw e.code === '23514' ? refuse() : e // 23514 = the stock >= 0 CHECK
  }
}

export async function applyDeltas(db, branchId, deltas) {
  for (const [productId, delta] of deltas) await moveStock(db, branchId, productId, delta)
}

export async function writeItems(db, deliveryId, items) {
  await db.query('DELETE FROM delivery_items WHERE delivery_id = $1', [deliveryId])
  await db.query(
    `INSERT INTO delivery_items (delivery_id, product_id, qty, unit_cost)
     SELECT $1, * FROM unnest($2::int[], $3::int[], $4::numeric[])`,
    [deliveryId, items.map((i) => i.productId), items.map((i) => i.qty), items.map((i) => i.unitCost)])
}
