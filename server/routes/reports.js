import { Router } from 'express'
import { query } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { asDay, fail, wrap } from '../utils/validate.js'
import { revenueWhere, repairTakingsWhere } from '../utils/rules.js'
import { COST } from './margins.js'
import { COST as VAPE_COST } from './vapes/margins.js'

// Admin-only revenue and profit report: every branch, or one branch. Electronics, vapes and repairs stay three separate
// blocks (CLAUDE.md rule 7); "everything" is an extra labelled line and never replaces them.
const router = Router()
router.use(protect, requireRole('admin'))

const pence = (n) => Math.round(Number(n || 0) * 100)
const pounds = (p) => p / 100

// $1 from, $2 to (UK days, blank = no limit), $3 branch (blank = all). `a` is the table alias.
const when = (a) => `($1::date IS NULL OR (${a}.paid_at AT TIME ZONE 'Europe/London')::date >= $1)
  AND ($2::date IS NULL OR (${a}.paid_at AT TIME ZONE 'Europe/London')::date <= $2) AND ($3::int IS NULL OR ${a}.branch_id = $3)`

const QTY = "(i->>'qty')::int"
const LINE = `(${QTY} * (i->>'price')::numeric)`
// One row per order line, with its bought-for price when there is one. LEFT JOIN keeps lines without a price: they are counted apart, never guessed.
const LINES = (orders, join = '') => `FROM ${orders} o CROSS JOIN LATERAL jsonb_array_elements(o.items) i
  ${join} LEFT JOIN cost c ON c.product_id = (i->>'productId')::int WHERE ${revenueWhere('o')} AND ${when('o')}`

const KINDS = {
  electronics: { orders: 'orders', cost: COST, products: 'products', label: 'p.name' },
  vapes: { orders: 'vape_orders', cost: VAPE_COST, products: 'vape_products', label: "p.name || COALESCE(' - ' || p.flavour, '')" },
}

// Revenue = what customers paid (order totals). Profit = line price minus bought-for price, before loyalty discounts, as on the Profit page.
async function sales(kind, params, withProducts) {
  const k = KINDS[kind]
  const [totals, lines, products] = await Promise.all([
    query(`SELECT o.branch_id, count(*)::int AS orders, COALESCE(sum(o.total), 0) AS revenue
           FROM ${k.orders} o WHERE ${revenueWhere('o')} AND ${when('o')} GROUP BY o.branch_id`, params),
    query(`WITH ${k.cost}
           SELECT o.branch_id, COALESCE(sum(${LINE}) FILTER (WHERE c.avg IS NOT NULL), 0) AS costed_revenue,
                  COALESCE(sum(${QTY} * c.avg), 0) AS cost, COALESCE(sum(${LINE}) FILTER (WHERE c.avg IS NULL), 0) AS uncosted
           ${LINES(k.orders)} GROUP BY o.branch_id`, params),
    withProducts
      ? query(`WITH ${k.cost}
               SELECT p.id, ${k.label} AS name, sum(${QTY})::int AS units, sum(${LINE}) AS revenue,
                      sum(${LINE}) FILTER (WHERE c.avg IS NOT NULL) - sum(${QTY} * c.avg) AS profit, bool_and(c.avg IS NOT NULL) AS cost_known
               ${LINES(k.orders, `JOIN ${k.products} p ON p.id = (i->>'productId')::int`)} GROUP BY p.id, ${k.label} ORDER BY revenue DESC, name LIMIT 100`, params)
      : { rows: [] },
  ])
  return { totals: totals.rows, lines: lines.rows, products: products.rows }
}

async function repairs(params) {
  const { rows } = await query(
    `SELECT r.branch_id, count(*)::int AS jobs, COALESCE(sum(r.paid_amount), 0) AS takings,
            COALESCE(sum((SELECT COALESCE(sum((p->>'cost')::numeric), 0) FROM jsonb_array_elements(r.parts) p)), 0) AS parts
     FROM repairs r WHERE ${repairTakingsWhere('r')} AND ${when('r')} GROUP BY r.branch_id`, params)
  return rows
}

// Whole pence all the way, so sums never drift.
const salesBlock = (s, id) => {
  const t = s.totals.find((x) => x.branch_id === id)
  const l = s.lines.find((x) => x.branch_id === id)
  const costed = pence(l?.costed_revenue), cost = pence(l?.cost)
  return { orders: t?.orders ?? 0, revenue: pence(t?.revenue), cost, profit: costed - cost, uncosted: pence(l?.uncosted) }
}
const repairBlock = (rows, id) => {
  const r = rows.find((x) => x.branch_id === id)
  const takings = pence(r?.takings), parts = pence(r?.parts)
  return { jobs: r?.jobs ?? 0, takings, parts, profit: takings - parts }
}
const sumOf = (blocks, keys) => Object.fromEntries(keys.map((k) => [k, blocks.reduce((n, b) => n + b[k], 0)]))
const money = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ['orders', 'jobs'].includes(k) ? v : pounds(v)]))

// ?branchId=&from=&to=  Blank branch = every branch (a row each, plus the combined total). Blank dates = everything to date.
router.get('/', wrap(async (req, res) => {
  const from = asDay(req.query.from, 'From')
  const to = asDay(req.query.to, 'To')
  let branchId = null
  if (req.query.branchId) {
    branchId = Number(req.query.branchId)
    if (!Number.isInteger(branchId)) throw fail(400, 'branchId must be a number')
  }
  const { rows: branchRows } = await query('SELECT id, area FROM branches WHERE $1::int IS NULL OR id = $1 ORDER BY area', [branchId])
  if (branchId && !branchRows.length) throw fail(404, 'Branch not found')

  const params = [from, to, branchId]
  const [electronics, vapes, repairRows] = await Promise.all([sales('electronics', params, !!branchId), sales('vapes', params, !!branchId), repairs(params)])

  const rows = branchRows.map((b) => ({ id: b.id, area: b.area, e: salesBlock(electronics, b.id), v: salesBlock(vapes, b.id), r: repairBlock(repairRows, b.id) }))
  // Everything together is a separate line: order revenue + vape revenue + repair takings, and the three profits added.
  const shape = ({ e, v, r }) => ({
    electronics: money(e), vapes: money(v), repairs: money(r),
    everything: { revenue: pounds(e.revenue + v.revenue + r.takings), profit: pounds(e.profit + v.profit + r.profit) },
  })
  const total = { e: sumOf(rows.map((x) => x.e), ['orders', 'revenue', 'cost', 'profit', 'uncosted']), v: sumOf(rows.map((x) => x.v), ['orders', 'revenue', 'cost', 'profit', 'uncosted']), r: sumOf(rows.map((x) => x.r), ['jobs', 'takings', 'parts', 'profit']) }

  const sold = (list) => list.map((p) => ({ productId: p.id, name: p.name, units: p.units, revenue: Number(p.revenue), profit: p.cost_known ? Number(p.profit) : null }))
  res.json({
    from, to,
    branch: branchId ? branchRows[0] : null,
    total: shape(total),
    branches: rows.map((x) => ({ id: x.id, area: x.area, ...shape(x) })),
    sold: branchId ? { electronics: sold(electronics.products), vapes: sold(vapes.products) } : null,
  })
}))

export default router
