import { Router } from 'express'
import { query } from '../../db.js'
import { protect, requireRole } from '../../middleware/auth.js'
import { scopeClause } from '../../utils/scope.js'
import { wrap } from '../../utils/validate.js'
import { revenueWhere } from '../../utils/rules.js'
import { VAPE_STATUS as V } from '../../utils/vapeRules.js'
import { vapeBrands, vapeProducts } from './catalogue.js'
import stock from './stock.js'
import deliveries from './deliveries.js'
import margins from './margins.js'
import orders from './orders.js'

// Everything under /api/vapes. Kept apart from the electronics routes so the two ranges never share
// stock, orders, revenue or profit.
const router = Router()
router.use('/brands', vapeBrands)
router.use('/products', vapeProducts)
router.use('/stock', stock)
router.use('/deliveries', deliveries)
router.use('/margins', margins)
router.use('/orders', orders)

// Staff (their branch) and admin (everything): the vape range at a glance. Vape revenue is its own figure.
router.get('/dashboard', protect, requireRole('staff', 'admin'), wrap(async (req, res) => {
  const so = scopeClause(req.user, { branch: 'o.branch_id' })
  const low = req.user.role === 'admin' ? { sql: 'TRUE', params: [] } : { sql: 'b.id = $1', params: [req.user.branch_id] }
  const [o, l] = await Promise.all([
    query(`SELECT count(*) FILTER (WHERE o.status IN ('${V.PENDING}', '${V.READY}'))::int AS open,
                  count(*) FILTER (WHERE o.payment_status = 'unpaid' AND o.status <> '${V.CANCELLED}')::int AS unpaid,
                  COALESCE(sum(o.total) FILTER (WHERE ${revenueWhere('o')} AND o.paid_at >= now() - interval '30 days'), 0) AS revenue30
           FROM vape_orders o WHERE ${so.sql}`, so.params),
    query(`SELECT count(*)::int AS n FROM vape_products p CROSS JOIN branches b
           LEFT JOIN vape_stock s ON s.product_id = p.id AND s.branch_id = b.id
           WHERE p.active = true AND b.active = true AND ${low.sql} AND COALESCE(s.stock, 0) <= 3`, low.params),
  ])
  res.json({ openOrders: o.rows[0].open, unpaidOrders: o.rows[0].unpaid, ...(req.user.role === 'admin' && { revenueLast30Days: Number(o.rows[0].revenue30) }), lowStock: l.rows[0].n })
}))

export default router
