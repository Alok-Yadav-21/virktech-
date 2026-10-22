import pool, { query } from './db.js'
import { createUser } from './utils/users.js'

// Creates the first (or another) admin. The only way to make an admin: the app itself never can.
// Usage: npm run create-admin -- --email owner@shop.com --name "Owner Name" --password "a-long-password"
// (or set ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD)
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : process.env[`ADMIN_${name.toUpperCase()}`]
}

try {
  const email = String(arg('email') || '').trim().toLowerCase()
  const name = String(arg('name') || '').trim()
  const password = String(arg('password') || '')
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Give a valid --email')
  if (!name) throw new Error('Give a --name')
  if (password.length < 12) throw new Error('Admin password must be at least 12 characters')
  if (/password123/i.test(password)) throw new Error('That is the demo password. Choose another one')
  if ((await query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount) throw new Error(`${email} already exists`)

  await createUser({ name, email, password, role: 'admin' })
  console.log(`Admin created: ${email}`)
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
