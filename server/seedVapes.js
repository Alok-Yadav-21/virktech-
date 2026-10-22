// Demo-only vape data: brands, products, one delivery per branch (which also sets stock and cost) and a few sales.
// Never part of the real-shop starter. Brand names are made up so no real company is implied.
const BRANDS = ['Cloud Co', 'Northern Mist', 'Vapor Lab']

// [brand, name, kind, flavour, flavourGroup, nicotineMg, sizeMl, price, wasPrice]
const PRODUCTS = [
  ['Cloud Co', 'Pod Kit Starter', 'Pod kit', null, 'Unflavoured', 0, null, 24.99, null],
  ['Cloud Co', 'Pod Kit Pro', 'Pod kit', null, 'Unflavoured', 0, null, 34.99, 44.99],
  ['Cloud Co', 'Refill Pods x2', 'Refill pod', 'Blueberry ice', 'Menthol & ice', 20, 2, 7.99, null],
  ['Cloud Co', 'Refill Pods x2', 'Refill pod', 'Watermelon', 'Fruit', 10, 2, 7.99, null],
  ['Cloud Co', 'Refill Pods x2', 'Refill pod', 'Cool mint', 'Menthol & ice', 20, 2, 7.99, null],
  ['Cloud Co', 'Refill Pods x2', 'Refill pod', 'Classic tobacco', 'Tobacco', 10, 2, 7.99, null],
  ['Northern Mist', 'Nic Salt 10ml', 'E-liquid', 'Strawberry cream', 'Sweet & dessert', 10, 10, 3.99, null],
  ['Northern Mist', 'Nic Salt 10ml', 'E-liquid', 'Mango ice', 'Fruit', 20, 10, 3.99, null],
  ['Northern Mist', 'Nic Salt 10ml', 'E-liquid', 'Blue razz lemonade', 'Drinks', 10, 10, 3.99, 4.99],
  ['Northern Mist', 'Nic Salt 10ml', 'E-liquid', 'Classic tobacco', 'Tobacco', 20, 10, 3.99, null],
  ['Northern Mist', 'Shortfill 100ml', 'E-liquid', 'Vanilla custard', 'Sweet & dessert', 0, 100, 12.99, null],
  ['Northern Mist', 'Shortfill 100ml', 'E-liquid', 'Apple pear', 'Fruit', 0, 100, 12.99, null],
  ['Vapor Lab', 'Cola Fizz 10ml', 'E-liquid', 'Cola', 'Drinks', 10, 10, 3.99, null],
  ['Vapor Lab', 'Energy Rush 10ml', 'E-liquid', 'Energy drink', 'Drinks', 10, 10, 3.99, null],
  ['Vapor Lab', 'Coil 0.8 ohm x5', 'Coil', null, 'Unflavoured', 0, null, 8.5, null],
  ['Vapor Lab', 'USB-C Charging Cable', 'Accessory', null, 'Unflavoured', 0, null, 4.99, null],
]

const DELIVERY_QTY = 12
const penceCost = (price) => Math.round(price * 0.45 * 100) / 100 // the shop paid about 45% of the shelf price

export async function seedVapesDemo(pool, branches, customerId) {
  const brandId = {}
  for (const name of BRANDS) {
    brandId[name] = (await pool.query('INSERT INTO vape_brands (name) VALUES ($1) RETURNING id', [name])).rows[0].id
  }
  const products = []
  for (const [brand, name, kind, flavour, flavourGroup, nicotineMg, sizeMl, price, wasPrice] of PRODUCTS) {
    const { rows: [p] } = await pool.query(
      `INSERT INTO vape_products (brand_id, name, kind, flavour, flavour_group, nicotine_mg, size_ml, price, was_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, price`,
      [brandId[brand], name, kind, flavour, flavourGroup, nicotineMg, sizeMl, price, wasPrice])
    products.push(p)
  }

  // One delivery per branch: it is the record of where that branch's opening stock came from, and what it cost.
  let n = 1000
  for (const id of Object.values(branches)) {
    const { rows: [d] } = await pool.query(
      `INSERT INTO vape_deliveries (reference, supplier, branch_id, note) VALUES ($1, 'Vape Wholesale Ltd', $2, 'Opening stock') RETURNING id`,
      ['VP-DEL-' + ++n, id])
    for (const [i, p] of products.entries()) {
      await pool.query('INSERT INTO vape_delivery_items (delivery_id, product_id, qty, unit_cost) VALUES ($1,$2,$3,$4)', [d.id, p.id, DELIVERY_QTY, penceCost(PRODUCTS[i][7])])
      await pool.query('INSERT INTO vape_stock (branch_id, product_id, stock) VALUES ($1,$2,$3)', [id, p.id, DELIVERY_QTY])
    }
  }
  await pool.query("SELECT setval('vape_del_seq', $1)", [n + 1])

  // Three sales at Belvedere so the orders list and the profit page have something to show.
  const belvedere = branches.Belvedere
  const sales = [
    { ref: 'VP-ORD-5001', status: 'collected', paid: true, lines: [[0, 1], [2, 2]] },
    { ref: 'VP-ORD-5002', status: 'collected', paid: true, lines: [[7, 3], [14, 1]] },
    { ref: 'VP-ORD-5003', status: 'pending', paid: false, lines: [[1, 1]] },
  ]
  for (const s of sales) {
    const items = s.lines.map(([i, qty]) => ({ productId: products[i].id, name: PRODUCTS[i][1], flavour: PRODUCTS[i][3], nicotineMg: PRODUCTS[i][5], price: PRODUCTS[i][7], qty }))
    const total = Math.round(items.reduce((sum, l) => sum + l.price * 100 * l.qty, 0)) / 100
    const history = [{ status: 'pending', at: new Date().toISOString(), by: 'Demo Customer' }]
    await pool.query(
      `INSERT INTO vape_orders (reference, customer_id, branch_id, items, total, payment_method, payment_status, status, age_confirmed, history, paid_at)
       VALUES ($1,$2,$3,$4,$5,'cash',$6,$7,true,$8,$9)`,
      [s.ref, customerId, belvedere, JSON.stringify(items), total, s.paid ? 'paid' : 'unpaid', s.status, JSON.stringify(history), s.paid ? new Date() : null])
    for (const l of items) await pool.query('UPDATE vape_stock SET stock = stock - $3 WHERE branch_id = $1 AND product_id = $2', [belvedere, l.productId, l.qty])
  }
  await pool.query("SELECT setval('vape_ord_seq', 5004)")
}
