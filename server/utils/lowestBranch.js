import { query } from '../db.js'

// The branch that needs restocking most: most product lines at 3 or fewer (same rule as the dashboard's Low stock
// card), then the smallest total stock, then the lowest id so the answer never flips between loads.
export async function lowestBranchId(productTable, stockTable) {
  const { rows } = await query(
    `SELECT b.id FROM branches b CROSS JOIN ${productTable} p
     LEFT JOIN ${stockTable} s ON s.product_id = p.id AND s.branch_id = b.id
     WHERE b.active = true AND p.active = true
     GROUP BY b.id
     ORDER BY count(*) FILTER (WHERE COALESCE(s.stock, 0) <= 3) DESC, sum(COALESCE(s.stock, 0)), b.id LIMIT 1`)
  return rows[0]?.id ?? null
}
