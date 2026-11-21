import { Router } from 'express'
import { query } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { createUser, hashPassword, WALK_IN_EMAIL } from '../utils/users.js'
import { pageOf, likeOf, sendPage } from '../utils/paging.js'
import { fail, isEmail, str, wrap } from '../utils/validate.js'

const router = Router()
router.use(protect, requireRole('admin'))

// Admins manage staff and customers only; other admin accounts are not editable here, so nobody can lock the owner out.
// (New admins are made with `npm run create-admin`.)
const MANAGED = ['staff', 'customer']

const SELECT = `
  SELECT u.id, u.name, u.email, u.phone, u.role, u.pin, u.daily_wage AS "dailyWage", u.staff_role AS "staffRole", u.last_login_at AS "lastLoginAt", u.last_ip AS "lastIp", (u.login_sid IS NOT NULL) AS "signedIn", u.branch_id AS "branchId", b.area AS "branchName",
         u.loyalty_points AS "loyaltyPoints", u.active, count(*) OVER() AS total_count
  FROM users u LEFT JOIN branches b ON b.id = u.branch_id`

const one = async (id) => (await query(`${SELECT} WHERE u.id = $1`, [id])).rows[0]
const target = async (req) => {
  if (!Number.isInteger(+req.params.id)) throw fail(404, 'User not found')
  const { rows } = await query('SELECT * FROM users WHERE id = $1 AND role = ANY($2)', [req.params.id, MANAGED])
  if (!rows[0]) throw fail(404, 'User not found')
  return rows[0]
}
const checkPassword = (p) => { if (typeof p !== 'string' || p.length < 8 || p.length > 200) throw fail(400, 'Password must be at least 8 characters') }
const clean = ({ total_count, ...u }) => u
const checkPin = (p) => { if (!/^\d{6}$/.test(String(p ?? ''))) throw fail(400, 'PIN must be exactly 6 digits'); return String(p) }
const checkWage = (w) => {
  if (w == null || w === '') return null
  if (!(Number(w) >= 0 && Number(w) < 1000)) throw fail(400, 'Daily wage must be between 0 and 1000')
  return Number(w)
}
// A role must be one admin has added (routes/staffRoles.js); matched ignoring case, stored as the listed spelling.
const checkStaffRole = async (r) => {
  if (r == null || r === '') return null
  const { rows } = await query('SELECT name FROM staff_roles WHERE lower(name) = lower($1)', [String(r).trim()])
  if (!rows[0]) throw fail(400, 'Choose one of the listed roles, or add it first')
  return rows[0].name
}
// 23505 = unique violation; the DB check avoids a race between two admins picking the same PIN.
const dup = (e) => { throw e.code === '23505' ? fail(409, e.constraint?.includes('pin') ? 'That PIN is already used by another staff member' : 'Email already registered') : e }

// ?role=staff|customer&branchId=&q=&limit=&offset=
router.get('/', wrap(async (req, res) => {
  const { role, branchId, q } = req.query
  const { limit, offset } = pageOf(req)
  const { rows } = await query(
    `${SELECT}
     WHERE ($1::text IS NULL OR u.role = $1) AND ($2::int IS NULL OR u.branch_id = $2)
       AND ($3::text IS NULL OR u.name ILIKE $3 OR u.email ILIKE $3 OR u.phone ILIKE $3)
       AND u.email IS DISTINCT FROM $6 AND ($7::boolean IS NOT TRUE OR u.active)
     ORDER BY u.name LIMIT $4 OFFSET $5`,
    [MANAGED.includes(role) || role === 'admin' ? role : null, branchId || null, q ? likeOf(q) : null, limit, offset, WALK_IN_EMAIL, req.query.active === '1']) // ?active=1 hides deleted accounts
  sendPage(res, rows, clean)
}))

router.post('/', wrap(async (req, res) => {
  const { password, role } = req.body
  if (!MANAGED.includes(role)) throw fail(400, 'Role must be staff or customer')
  const name = str(req.body.name, { max: 100, label: 'Name', required: true })
  const phone = str(req.body.phone, { max: 30, label: 'Phone' }) || null
  let fields
  if (role === 'staff') {
    fields = { pin: checkPin(req.body.pin), dailyWage: checkWage(req.body.dailyWage), staffRole: await checkStaffRole(req.body.staffRole) } // branch comes from the sign-in IP
  } else {
    const email = str(req.body.email, { max: 254, label: 'Email', required: true }).toLowerCase()
    if (!isEmail(email)) throw fail(400, 'Enter a valid email')
    checkPassword(password)
    fields = { email, password }
  }
  const user = await createUser({ name, phone, role, ...fields }).catch(dup)
  res.status(201).json(clean(await one(user.id)))
}))

router.put('/:id', wrap(async (req, res) => {
  const user = await target(req)
  const { name, email, phone, active, password } = req.body
  const sets = []
  const vals = []
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`) }

  if (name !== undefined) set('name', str(name, { max: 100, label: 'Name', required: true }))
  if (email !== undefined && user.role === 'customer') {
    const e = str(email, { max: 254, label: 'Email', required: true }).toLowerCase()
    if (!isEmail(e)) throw fail(400, 'Enter a valid email')
    set('email', e)
  }
  if (phone !== undefined) set('phone', str(phone, { max: 30, label: 'Phone' }) || null)
  if (typeof active === 'boolean') { set('active', active); if (!active) sets.push('login_sid = NULL') }
  if (user.role === 'staff') {
    if (req.body.pin !== undefined && checkPin(req.body.pin) !== user.pin) { // a new PIN ends the old holder's sessions
      set('pin', String(req.body.pin))
      sets.push('password_changed_at = now()', 'login_sid = NULL') // frees the sign-in too, or they could not use the new PIN
    }
    if (req.body.dailyWage !== undefined) set('daily_wage', checkWage(req.body.dailyWage))
    if (req.body.staffRole !== undefined) set('staff_role', await checkStaffRole(req.body.staffRole))
  }
  if (password && user.role === 'customer') { // blank = keep current. A reset also ends the user's existing sessions.
    checkPassword(password)
    set('password', await hashPassword(password))
    sets.push('password_changed_at = now()')
  }

  if (sets.length) {
    vals.push(user.id)
    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals).catch(dup)
  }
  res.json(clean(await one(user.id)))
}))

// Users are referenced by repairs, orders, shifts and points, so "delete" switches the account off instead.
// A staff PIN is cleared too, so it can be given to someone new (their shifts and sales keep their name).
router.delete('/:id', wrap(async (req, res) => {
  const user = await target(req)
  await query("UPDATE users SET active = false, login_sid = NULL, pin = CASE WHEN role = 'staff' THEN NULL ELSE pin END WHERE id = $1", [user.id])
  res.json({ ok: true })
}))

// Ends a staff member's live sign-in on every device: for someone who closed the browser without logging out, or
// whose PIN may have been seen. Their next sign-in works as normal.
router.post('/:id/sign-out', wrap(async (req, res) => {
  const user = await target(req)
  if (user.role !== 'staff') throw fail(400, 'Only staff have a sign-in to end')
  await query('UPDATE users SET login_sid = NULL WHERE id = $1', [user.id])
  res.json(clean(await one(user.id)))
}))

export default router
