import { Router } from 'express'
import { query } from '../../db.js'
import { protect, requireRole } from '../../middleware/auth.js'
import { fail, wrap } from '../../utils/validate.js'
import { branchFor } from '../../utils/scope.js'
import { lowestBranchId } from '../../utils/lowestBranch.js'

const router = Router()
router.use(protect, requireRole('staff', 'admin'))

// Admin: the branch to show first on the Vape stock page.
router.get('/lowest-branch', requireRole('admin'), wrap(async (req, res) => {
  res.json({ branchId: await lowestBranchId('vape_products', 'vape_stock') })
}))

// Every active vape product with this branch's count (0 when no count has been entered yet).
router.get('/', wrap(async (req, res) => {
  const branchId = branchFor(req)
  const { rows } = await query(
    `SELECT p.id AS "productId", p.name, b.name AS brand, p.barcode, p.flavour, p.kind, p.nicotine_mg AS "nicotineMg", COALESCE(s.stock, 0)::int AS stock
     FROM vape_products p JOIN vape_brands b ON b.id = p.brand_id
     LEFT JOIN vape_stock s ON s.product_id = p.id AND s.branch_id = $1
     WHERE p.active = true ORDER BY stock, b.name, p.name, p.flavour`, [branchId])
  res.json(rows)
}))

// Set the counted stock for one product at one branch.
router.patch('/:productId', wrap(async (req, res) => {
  const branchId = branchFor(req)
  const { stock } = req.body
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) throw fail(400, 'Stock must be a whole number, 0 or more')
  if (!Number.isInteger(+req.params.productId)) throw fail(404, 'Product not found')
  if (!(await query('SELECT 1 FROM branches WHERE id = $1 AND active = true', [branchId])).rowCount) throw fail(400, 'Choose an active branch')
  if (!(await query('SELECT 1 FROM vape_products WHERE id = $1', [req.params.productId])).rowCount) throw fail(404, 'Product not found')
  const { rows } = await query(
    `INSERT INTO vape_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
     ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = EXCLUDED.stock
     RETURNING product_id AS "productId", branch_id AS "branchId", stock`, [branchId, req.params.productId, stock])
  res.json(rows[0])
}))

export default router
