import { query, tx } from '../db.js'
import { scopeClause } from './scope.js'
import { fail } from './validate.js'
import { likeOf } from './paging.js'
import { lineCost, stockDeltas } from './rules.js'
import { readHead, readItems } from './deliveries.js'
import { nextVapeReference } from './vapeReference.js'

// Vape twins of the helpers in deliveries.js (same shape, vape_* tables). Validation (readHead, readItems)
// and the row mapper (toDelivery) are shared with the electronics side and imported from there.
const SELECT = `
  SELECT d.id, d.reference, d.supplier, d.branch_id, to_char(d.received_on, 'YYYY-MM-DD') AS received_on, d.note, d.created_at,
         b.area AS branch_area, u.name AS created_by_name,
         COALESCE(t.units, 0)::int AS units, COALESCE(t.cost, 0) AS cost, COALESCE(t.lines, 0)::int AS lines,
         count(*) OVER() AS total_count
  FROM vape_deliveries d
  JOIN branches b ON b.id = d.branch_id
  LEFT JOIN users u ON u.id = d.created_by
  LEFT JOIN (SELECT delivery_id, sum(qty) AS units, sum(qty * unit_cost) AS cost, count(*) AS lines
             FROM vape_delivery_items GROUP BY delivery_id) t ON t.delivery_id = d.id`

const TODAY = "(d.created_at AT TIME ZONE 'Europe/London')::date = (now() AT TIME ZONE 'Europe/London')::date"

export async function findVapeDeliveries(user, { id, q, today, limit = 100, offset = 0 } = {}) {
  const scope = scopeClause(user, { branch: 'd.branch_id' })
  const where = [scope.sql]
  const params = [...scope.params]
  if (id) { params.push(id); where.push(`d.id = $${params.length}`) }
  if (today) where.push(TODAY)
  if (q) {
    params.push(likeOf(q))
    where.push(`(d.reference ILIKE $${params.length} OR d.supplier ILIKE $${params.length})`)
  }
  params.push(limit, offset)
  const { rows } = await query(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY d.received_on DESC, d.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
  return rows
}

export async function vapeItemsOf(deliveryId, db = { query }) {
  const { rows } = await db.query(
    `SELECT i.product_id AS "productId", p.name, p.flavour, i.qty, i.unit_cost AS "unitCost", p.price AS "sellPrice"
     FROM vape_delivery_items i JOIN vape_products p ON p.id = i.product_id WHERE i.delivery_id = $1 ORDER BY p.name, p.flavour`, [deliveryId])
  return rows.map((r) => ({ ...r, unitCost: Number(r.unitCost), sellPrice: Number(r.sellPrice), lineCost: lineCost(r.qty, r.unitCost) }))
}

export async function checkVapeProducts(items) {
  const ids = items.map((i) => i.productId)
  const { rowCount } = await query('SELECT 1 FROM vape_products WHERE id = ANY($1::int[])', [ids])
  if (rowCount !== ids.length) throw fail(400, 'One of the products no longer exists')
}

// Going below zero means those pieces were already sold, so refuse.
async function moveStock(db, branchId, productId, delta) {
  const refuse = () => fail(409, 'Some of this stock has already been sold, so the delivery cannot be reduced or removed that far')
  if (delta > 0) {
    await db.query(
      `INSERT INTO vape_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = vape_stock.stock + EXCLUDED.stock`, [branchId, productId, delta])
    return
  }
  try {
    const { rowCount } = await db.query('UPDATE vape_stock SET stock = stock + $3 WHERE branch_id = $1 AND product_id = $2', [branchId, productId, delta])
    if (!rowCount) throw refuse()
  } catch (e) {
    throw e.code === '23514' ? refuse() : e
  }
}

export async function applyVapeDeltas(db, branchId, deltas) {
  for (const [productId, delta] of deltas) await moveStock(db, branchId, productId, delta)
}

export async function writeVapeItems(db, deliveryId, items) {
  await db.query('DELETE FROM vape_delivery_items WHERE delivery_id = $1', [deliveryId])
  await db.query(
    `INSERT INTO vape_delivery_items (delivery_id, product_id, qty, unit_cost)
     SELECT $1, * FROM unnest($2::int[], $3::int[], $4::numeric[])`,
    [deliveryId, items.map((i) => i.productId), items.map((i) => i.qty), items.map((i) => i.unitCost)])
}

// Vape twin of receiveDelivery: records the delivery and adds the pieces to vape stock, all or nothing.
export async function receiveVapeDelivery(user, branchId, body) {
  if (!(await query('SELECT 1 FROM branches WHERE id = $1 AND active = true', [branchId])).rowCount) throw fail(400, 'Choose an active branch')
  const head = readHead(body)
  const items = readItems(body.items)
  await checkVapeProducts(items)
  const reference = await nextVapeReference('DEL')
  return tx(async (db) => {
    const { rows: [d] } = await db.query(
      'INSERT INTO vape_deliveries (reference, supplier, branch_id, received_on, note, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [reference, head.supplier, branchId, head.receivedOn, head.note, user.id])
    await writeVapeItems(db, d.id, items)
    await applyVapeDeltas(db, branchId, stockDeltas([], items))
    return d.id
  })
}
