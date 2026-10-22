import { query } from '../db.js'
import crud from './crud.js'
import { byDistance } from '../utils/geo.js'
import { fail, wrap } from '../utils/validate.js'

export const categories = crud({
  table: 'categories', fields: { name: 'name' }, required: ['name'], order: 't.name',
})

export const services = crud({
  table: 'services', required: ['title'], order: 't.id',
  fields: { title: 'title', description: 'description', icon: 'icon', basePrice: 'base_price', active: 'active' },
})

// Stock is per branch (see routes/stock.js); products only report the total across active branches.
export const products = crud({
  table: 'products', required: ['name', 'categoryId', 'price'], order: 't.id', softDelete: true,
  join: 'JOIN categories c ON c.id = t.category_id',
  extra: `, c.name AS category,
    COALESCE((SELECT sum(s.stock) FROM branch_stock s JOIN branches b ON b.id = s.branch_id AND b.active = true WHERE s.product_id = t.id), 0)::int AS "stockTotal"`,
  fields: {
    name: 'name', brand: 'brand', categoryId: 'category_id', price: 'price', wasPrice: 'was_price',
    condition: 'condition', image: 'image', description: 'description', active: 'active',
  },
  // Which branches have it, so a customer knows where they can collect. Registered before /:id.
  setup: (router) => router.get('/:id/availability', wrap(async (req, res) => {
    if (!Number.isInteger(+req.params.id)) throw fail(404, 'Not found')
    const { rows } = await query(
      `SELECT b.id AS "branchId", b.area, COALESCE(s.stock, 0)::int AS stock
       FROM branches b LEFT JOIN branch_stock s ON s.branch_id = b.id AND s.product_id = $1
       WHERE b.active = true ORDER BY b.area`, [req.params.id])
    res.json(rows)
  })),
})

export const branches = crud({
  table: 'branches', required: ['name', 'area'], order: 't.id',
  fields: {
    name: 'name', area: 'area', address: 'address', postcode: 'postcode',
    lat: 'lat', lng: 'lng', phone: 'phone', active: 'active',
  },
  // Must be registered before /:id. postcodes.io needs no API key.
  setup: (router) => router.get('/nearest', wrap(async (req, res) => {
    const postcode = String(req.query.postcode || '').trim().slice(0, 12)
    if (!postcode) throw fail(400, 'postcode is required')
    let r
    try {
      r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, { signal: AbortSignal.timeout(5000) })
    } catch { throw fail(502, 'Postcode lookup unavailable, try again') }
    if (r.status === 404) throw fail(404, 'Postcode not found')
    if (!r.ok) throw fail(502, 'Postcode lookup unavailable, try again')
    const { latitude: lat, longitude: lng } = (await r.json()).result
    const { rows } = await query('SELECT id, name, area, address, postcode, lat, lng, phone FROM branches WHERE active = true')
    res.json({ origin: { lat, lng }, branches: byDistance(rows, { lat, lng }) })
  })),
})
