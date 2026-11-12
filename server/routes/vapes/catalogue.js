import { query } from '../../db.js'
import crud from '../crud.js'
import { fail, wrap } from '../../utils/validate.js'

// Companies (brands) and the products under them. Same generic CRUD the electronics catalogue uses;
// public sees active rows only, ?all=1 is the admin view.
export const vapeBrands = crud({
  table: 'vape_brands', fields: { name: 'name', active: 'active' }, required: ['name'], order: 't.name', softDelete: true,
})

// One product = one flavour and strength of one brand, each with its own stock and price.
export const vapeProducts = crud({
  table: 'vape_products', required: ['name', 'brandId', 'kind', 'price', 'costPrice'], order: 't.id', softDelete: true,
  join: 'JOIN vape_brands b ON b.id = t.brand_id',
  extra: `, b.name AS brand,
    COALESCE((SELECT sum(s.stock) FROM vape_stock s JOIN branches br ON br.id = s.branch_id AND br.active = true WHERE s.product_id = t.id), 0)::int AS "stockTotal"`,
  fields: {
    name: 'name', brandId: 'brand_id', kind: 'kind', flavour: 'flavour', flavourGroup: 'flavour_group', nicotineMg: 'nicotine_mg',
    sizeMl: 'size_ml', price: 'price', wasPrice: 'was_price', image: 'image', description: 'description', active: 'active',
  },
  adminFields: { costPrice: 'cost_price', barcode: 'barcode' }, // cost_price: what the shop paid before deliveries were recorded; barcode: what the till scans
  // Which branches have it, so a customer knows where they can collect. Registered before /:id.
  setup: (router) => router.get('/:id/availability', wrap(async (req, res) => {
    if (!Number.isInteger(+req.params.id)) throw fail(404, 'Not found')
    const { rows } = await query(
      `SELECT b.id AS "branchId", b.area, COALESCE(s.stock, 0)::int AS stock
       FROM branches b LEFT JOIN vape_stock s ON s.branch_id = b.id AND s.product_id = $1
       WHERE b.active = true ORDER BY b.area`, [req.params.id])
    res.json(rows)
  })),
})
