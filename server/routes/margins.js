import { Router } from 'express'
import { query } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { scopeClause } from '../utils/scope.js'
import { pageOf, likeOf } from '../utils/paging.js'
import { wrap } from '../utils/validate.js'
import { revenueWhere, repairTakingsWhere, unitProfit, marginPct } from '../utils/rules.js'

const router = Router()
router.use(protect, requireRole('admin')) // staff never see profit

// Average buy price per product over every delivery, weighted by quantity. Cost is the same for every branch;
// quantities, stock and sales are limited to the caller's scope (staff = own branch).
// Bought-for price per product: the average over recorded deliveries, or else the price an admin typed on the product
// (stock that arrived before deliveries were recorded). Products with neither have no row, so they are never guessed.
export const COST = `cost AS (SELECT p.id AS product_id, COALESCE(d.avg, p.cost_price) AS avg,
  CASE WHEN d.avg IS NOT NULL THEN 'deliveries' ELSE 'typed' END AS src FROM products p
  LEFT JOIN (SELECT product_id, round(sum(qty * unit_cost) / sum(qty), 2) AS avg FROM delivery_items GROUP BY product_id) d ON d.product_id = p.id
  WHERE COALESCE(d.avg, p.cost_price) IS NOT NULL)`
// One row per product line on a paid order that has not been cancelled or refunded.
const SOLD = (scopeSql) => `
  SELECT (i->>'productId')::int AS product_id, (i->>'qty')::int AS qty, (i->>'price')::numeric AS price, o.paid_at
  FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) i
  WHERE ${revenueWhere('o')} AND ${scopeSql}`

const pence = (n) => Math.round(Number(n) * 100)

// Per product: what it cost, what it sells for, the gap, and what has actually been earned so far.
router.get('/', wrap(async (req, res) => {
  const { limit, offset } = pageOf(req)
  const so = scopeClause(req.user, { branch: 'o.branch_id' })
  const sd = scopeClause(req.user, { branch: 'd.branch_id' })
  const ss = scopeClause(req.user, { branch: 's.branch_id' })
  const params = [...so.params] // staff: $1 is their branch, shared by all three scope clauses
  let q = ''
  const missing = req.query.missing ? 'AND c.avg IS NULL' : '' // admin's to-do list: products still without a bought-for price
  if (req.query.q) { params.push(likeOf(req.query.q)); q = `AND (p.name ILIKE $${params.length} OR p.brand ILIKE $${params.length})` }
  params.push(limit, offset)
  const { rows } = await query(
    `WITH ${COST},
     sold AS (SELECT product_id, sum(qty)::int AS units, sum(qty * price) AS revenue FROM (${SOLD(so.sql)}) s GROUP BY product_id),
     rec AS (SELECT i.product_id, sum(i.qty)::int AS units FROM delivery_items i JOIN deliveries d ON d.id = i.delivery_id
             WHERE ${sd.sql} GROUP BY i.product_id),
     held AS (SELECT s.product_id, sum(s.stock)::int AS units FROM branch_stock s WHERE ${ss.sql} GROUP BY s.product_id)
     SELECT p.id, p.name, p.brand, p.condition, p.price, c.avg AS cost, c.src AS cost_source,
            COALESCE(rec.units, 0) AS received, COALESCE(held.units, 0) AS in_stock,
            COALESCE(sold.units, 0) AS sold, COALESCE(sold.revenue, 0) AS revenue, count(*) OVER() AS total_count
     FROM products p
     LEFT JOIN cost c ON c.product_id = p.id LEFT JOIN rec ON rec.product_id = p.id
     LEFT JOIN held ON held.product_id = p.id LEFT JOIN sold ON sold.product_id = p.id
     WHERE (p.active = true OR sold.units > 0) ${q} ${missing} ORDER BY p.name LIMIT $${params.length - 1} OFFSET $${params.length}`, params)

  res.set('X-Total-Count', String(rows[0]?.total_count ?? 0))
  res.json(rows.map((r) => {
    const cost = r.cost == null ? null : Number(r.cost)
    return {
      productId: r.id, name: r.name, brand: r.brand, condition: r.condition,
      sellPrice: Number(r.price), cost, costSource: r.cost_source, unitProfit: unitProfit(r.price, cost), marginPct: marginPct(r.price, cost),
      received: r.received, inStock: r.in_stock, sold: r.sold,
      // Earned so far = what customers paid minus what those pieces cost on average.
      profitToDate: cost == null ? null : (pence(r.revenue) - r.sold * pence(cost)) / 100,
    }
  }))
}))

// Headline numbers. Only products that have a recorded cost count, so nothing is flattered by guessing.
router.get('/summary', wrap(async (req, res) => {
  const so = scopeClause(req.user, { branch: 'o.branch_id' })
  const sd = scopeClause(req.user, { branch: 'd.branch_id' })
  const ss = scopeClause(req.user, { branch: 's.branch_id' })
  const sr = scopeClause(req.user, { branch: 'r.branch_id' })
  const [earned, held, bought, uncosted, repairs] = await Promise.all([
    query(`WITH ${COST}
           SELECT COALESCE(sum(s.qty * (s.price - c.avg)), 0) AS profit,
                  COALESCE(sum(s.qty * (s.price - c.avg)) FILTER (WHERE s.paid_at >= now() - interval '30 days'), 0) AS profit30
           FROM (${SOLD(so.sql)}) s JOIN cost c ON c.product_id = s.product_id`, so.params),
    query(`WITH ${COST}
           SELECT COALESCE(sum(s.stock * c.avg), 0) AS at_cost, COALESCE(sum(s.stock * p.price), 0) AS at_price
           FROM branch_stock s JOIN products p ON p.id = s.product_id JOIN cost c ON c.product_id = s.product_id
           WHERE ${ss.sql}`, ss.params),
    query(`SELECT COALESCE(sum(i.qty * i.unit_cost) FILTER (WHERE d.received_on >= CURRENT_DATE - 30), 0) AS spent30
           FROM delivery_items i JOIN deliveries d ON d.id = i.delivery_id WHERE ${sd.sql}`, sd.params),
    // Sales of products no delivery has priced: shown as their own figure so they are counted, not hidden, and not guessed at.
    query(`WITH ${COST}
           SELECT COALESCE(sum(s.qty * s.price), 0) AS revenue,
                  (SELECT count(*) FROM products p WHERE (p.active OR p.id IN (SELECT product_id FROM (${SOLD(so.sql)}) x)) AND NOT EXISTS (SELECT 1 FROM cost c WHERE c.product_id = p.id)) AS items
           FROM (${SOLD(so.sql)}) s WHERE NOT EXISTS (SELECT 1 FROM cost c WHERE c.product_id = s.product_id)`, so.params),
    // Repairs on their own line (rule 7): what customers paid minus the parts logged on the job.
    query(`SELECT COALESCE(sum(r.paid_amount), 0) AS takings,
                  COALESCE(sum((SELECT COALESCE(sum((p->>'cost')::numeric), 0) FROM jsonb_array_elements(r.parts) p)), 0) AS parts
           FROM repairs r WHERE ${repairTakingsWhere('r')} AND ${sr.sql}`, sr.params),
  ])
  const [e, h, b, u, r] = [earned.rows[0], held.rows[0], bought.rows[0], uncosted.rows[0], repairs.rows[0]]
  res.json({
    profitToDate: Number(e.profit), profitLast30Days: Number(e.profit30),
    stockAtCost: Number(h.at_cost), stockAtPrice: Number(h.at_price),
    stockPotentialProfit: (pence(h.at_price) - pence(h.at_cost)) / 100,
    spentLast30Days: Number(b.spent30),
    salesWithoutCost: Number(u.revenue), itemsWithoutCost: Number(u.items),
    repairTakings: Number(r.takings), repairPartsCost: Number(r.parts), repairProfit: (pence(r.takings) - pence(r.parts)) / 100,
  })
}))

export default router
