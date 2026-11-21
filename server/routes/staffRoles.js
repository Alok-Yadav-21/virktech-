import { Router } from 'express'
import { query } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { fail, wrap } from '../utils/validate.js'

// The list of staff roles, which admin can add to. A role is only a label on a staff member (no permissions hang off it).
const router = Router()
router.use(protect, requireRole('admin'))

const all = async () => (await query('SELECT name FROM staff_roles ORDER BY name')).rows.map((r) => r.name)

router.get('/', wrap(async (req, res) => res.json(await all())))

router.post('/', wrap(async (req, res) => {
  const name = String(req.body.name ?? '').replace(/\s+/g, ' ').trim()
  if (!name || name.length > 40) throw fail(400, 'A role name is 1 to 40 characters')
  try {
    await query('INSERT INTO staff_roles (name) VALUES ($1)', [name])
  } catch (e) {
    if (e.code === '23505') throw fail(409, 'That role already exists')
    throw e
  }
  res.status(201).json({ name, roles: await all() })
}))

export default router
