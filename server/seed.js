import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import pool from './db.js'
import { runMigrations } from './migrate.js'
import { seedVapesDemo } from './seedVapes.js'
import { createUser } from './utils/users.js'

const load = (n) => JSON.parse(readFileSync(new URL(`./data/${n}.json`, import.meta.url), 'utf8'))

// Starter catalogue for a new shop: the 8 branches, services, categories and products. No users, no stock
// (staff enter real counts per branch). Only loads into an empty database so it can never duplicate data.
export async function seedStarter(db = pool) {
  const { rows: [{ n }] } = await db.query('SELECT count(*) AS n FROM branches')
  if (n > 0) throw new Error('Starter data only loads into an empty database: branches already exist.')

  const branches = {}
  for (const b of load('branches')) {
    const { rows } = await db.query(
      'INSERT INTO branches (name, area, address, postcode, lat, lng) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [b.name, b.area, b.address, b.postcode, b.lat, b.lng])
    branches[b.area] = rows[0].id
  }
  for (const s of load('services')) {
    await db.query('INSERT INTO services (title, description, icon, base_price) VALUES ($1,$2,$3,$4)', [s.title, s.description, s.icon, s.basePrice])
  }
  const products = load('products')
  const cats = {}
  for (const name of new Set(products.map((p) => p.category))) {
    cats[name] = (await db.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [name])).rows[0].id
  }
  const productIds = []
  for (const p of products) {
    const { rows } = await db.query(
      `INSERT INTO products (name, brand, category_id, price, was_price, condition, image, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [p.name, p.brand, cats[p.category], p.price, p.wasPrice ?? null, p.condition, p.image, p.description])
    productIds.push(rows[0].id)
  }
  return { branches, productIds }
}

// The demo seed wipes everything, so it refuses anything that looks like a real shop.
async function assertSafeToReset(force) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run: NODE_ENV=production. The demo seed wipes the database.')
  const { rows: [t] } = await pool.query("SELECT to_regclass('public.users') AS t")
  if (!t.t) return
  const { rows: [r] } = await pool.query("SELECT count(*) AS n FROM users WHERE email NOT LIKE '%@demo.com'")
  if (r.n > 0 && !force) {
    throw new Error(`Refusing to run: ${r.n} non-demo user(s) exist, so this looks like real data. Re-run with --force only if you are certain.`)
  }
}

// Drops everything, rebuilds the schema, and loads starter data + demo users with 10 of everything in every branch.
export async function seedDemo({ force = false } = {}) {
  await assertSafeToReset(force)
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await runMigrations()
  const { branches, productIds } = await seedStarter()
  for (const branchId of Object.values(branches)) {
    for (const productId of productIds) {
      await pool.query('INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1,$2,10)', [branchId, productId])
    }
  }
  const ids = {}
  for (const u of [
    { name: 'Demo Customer', email: 'customer@demo.com', role: 'customer' },
    { name: 'Demo Staff', email: 'staff@demo.com', role: 'staff', branchId: branches.Belvedere },
    { name: 'Demo Admin', email: 'admin@demo.com', role: 'admin' },
  ]) ids[u.role] = (await createUser({ ...u, password: 'Password123!' })).id
  await seedVapesDemo(pool, branches, ids.customer)
}

// `npm run seed` = demo data. `npm run seed:starter` = real-shop starter catalogue (needs `npm run migrate` first).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('starter')) {
      await seedStarter()
      console.log('Loaded starter branches, services, categories and products (no stock). Next: npm run create-admin')
    } else {
      await seedDemo({ force: process.argv.includes('--force') })
      console.log('Demo database ready. Logins: customer@demo.com, staff@demo.com, admin@demo.com (Password123!)')
    }
  } catch (e) {
    console.error(e.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}
