import { Router } from 'express'
import { query } from '../db.js'
import { protect } from '../middleware/auth.js'
import { scopeClause } from '../utils/scope.js'
import { wrap } from '../utils/validate.js'
import {
  REPAIR_STATUS as S, TRADEIN_STATUS as T, REPAIR_CLOSED, ORDER_CLOSED, TRADEIN_CLOSED, revenueWhere, repairTakingsWhere,
} from '../utils/rules.js'

const router = Router()

// open/total for one table, limited to what this user may see.
async function counts(user, table, closed) {
  const scope = scopeClause(user)
  const { rows: [r] } = await query(
    `SELECT count(*) FILTER (WHERE status <> ALL($${scope.params.length + 1}::text[])) AS open, count(*) AS total
     FROM ${table} WHERE ${scope.sql}`, [...scope.params, closed])
  return r
}

async function countWhere(user, table, extra, params = []) {
  const scope = scopeClause(user)
  const shifted = extra.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + scope.params.length}`)
  const { rows: [r] } = await query(`SELECT count(*) AS n FROM ${table} WHERE ${scope.sql} AND ${shifted}`, [...scope.params, ...params])
  return r.n
}

// 14 UK days ending today, zero-filled so quiet days still show.
const DAYS = `generate_series((now() AT TIME ZONE 'Europe/London')::date - 13, (now() AT TIME ZONE 'Europe/London')::date, interval '1 day')`

// Role-shaped summary. Customers get their own numbers; staff their branch; admin everything.
router.get('/stats', protect, wrap(async (req, res) => {
  const user = req.user
  const [repairs, orders, tradeIns] = await Promise.all([
    counts(user, 'repairs', REPAIR_CLOSED), counts(user, 'orders', ORDER_CLOSED), counts(user, 'trade_ins', TRADEIN_CLOSED),
  ])
  const stats = { role: user.role, repairs, orders, tradeIns }

  if (user.role === 'customer') {
    stats.loyaltyPoints = user.loyalty_points
    // The things only the customer can unblock.
    stats.quotesToApprove = await countWhere(user, 'repairs', 'status = $1', [S.QUOTE])
    stats.offersToAnswer = await countWhere(user, 'trade_ins', 'status = $1', [T.OFFER_SENT])
    return res.json(stats)
  }

  const o = scopeClause(user, { branch: 'o.branch_id' })
  const r = scopeClause(user, { branch: 'r.branch_id' })
  const branchOnly = user.role === 'admin' ? 'TRUE' : 'b.id = $1'
  const branchParams = user.role === 'admin' ? [] : [user.branch_id]
  // Low stock = active product/branch pairs at 3 or fewer (a missing count is zero), within the caller's scope.
  const low = user.role === 'admin' ? { sql: 'TRUE', params: [] } : { sql: 'b.id = $1', params: [user.branch_id] }

  const [byStatus, orderDays, repairDays, orderBranches, repairBranches, lowStock] = await Promise.all([
    query(`SELECT status, count(*) AS count FROM repairs r WHERE ${r.sql} AND status <> ALL($${r.params.length + 1}::text[])
           GROUP BY status ORDER BY count DESC`, [...r.params, REPAIR_CLOSED]),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(sum(o.total), 0) AS revenue, count(o.id) AS orders
           FROM ${DAYS} d
           LEFT JOIN orders o ON (o.paid_at AT TIME ZONE 'Europe/London')::date = d::date AND ${revenueWhere('o')} AND ${o.sql}
           GROUP BY d ORDER BY d`, o.params),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(sum(r.paid_amount), 0) AS takings, count(r.id) AS repairs
           FROM ${DAYS} d
           LEFT JOIN repairs r ON (r.paid_at AT TIME ZONE 'Europe/London')::date = d::date AND ${repairTakingsWhere('r')} AND ${r.sql}
           GROUP BY d ORDER BY d`, r.params),
    query(`SELECT b.area AS branch, COALESCE(sum(o.total), 0) AS revenue
           FROM branches b
           LEFT JOIN orders o ON o.branch_id = b.id AND o.paid_at >= now() - interval '30 days' AND ${revenueWhere('o')}
           WHERE ${branchOnly} GROUP BY b.area`, branchParams),
    query(`SELECT b.area AS branch, COALESCE(sum(r.paid_amount), 0) AS takings
           FROM branches b
           LEFT JOIN repairs r ON r.branch_id = b.id AND r.paid_at >= now() - interval '30 days' AND ${repairTakingsWhere('r')}
           WHERE ${branchOnly} GROUP BY b.area`, branchParams),
    query(`SELECT count(*) AS n FROM products p CROSS JOIN branches b
           LEFT JOIN branch_stock s ON s.product_id = p.id AND s.branch_id = b.id
           WHERE p.active = true AND b.active = true AND ${low.sql} AND COALESCE(s.stock, 0) <= 3`, low.params),
  ])

  // Order revenue and repair takings stay separate figures; they are never added together.
  const takingsByDay = new Map(repairDays.rows.map((x) => [x.day, x]))
  const takingsByBranch = new Map(repairBranches.rows.map((x) => [x.branch, x.takings]))
  stats.repairsByStatus = byStatus.rows
  stats.unpaidOrders = await countWhere(user, 'orders', "payment_status = 'unpaid' AND status <> 'cancelled'")
  stats.repairsAwaitingPayment = await countWhere(user, 'repairs', "payment_status = 'unpaid' AND status = ANY($1)", [[S.READY, S.DISPATCHED]])
  stats.revenueByDay = orderDays.rows.map((d) => ({ ...d, repairTakings: takingsByDay.get(d.day).takings, repairsPaid: takingsByDay.get(d.day).repairs }))
  stats.revenueByBranch = orderBranches.rows
    .map((b) => ({ ...b, repairTakings: takingsByBranch.get(b.branch) ?? 0 }))
    .sort((a, b) => (b.revenue + b.repairTakings) - (a.revenue + a.repairTakings) || a.branch.localeCompare(b.branch))
  stats.lowStock = lowStock.rows[0].n
  res.json(stats)
}))

export default router
