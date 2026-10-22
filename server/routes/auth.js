import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { body, validationResult } from 'express-validator'
import { query } from '../db.js'
import { createUser, hashPassword, toPublic, DUMMY_HASH } from '../utils/users.js'
import { protect } from '../middleware/auth.js'
import { loginLimiter, registerLimiter } from '../middleware/limits.js'
import { config } from '../config.js'
import { fail, str, wrap } from '../utils/validate.js'

const router = Router()

const COOKIE = { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' }
const setCookie = (res, user) => {
  // pv ties the token to the password it was issued under; changing the password invalidates it (no clock comparison).
  const token = jwt.sign({ id: user.id, pv: user.password_changed_at?.getTime() ?? 0 }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('token', token, { ...COOKIE, maxAge: 7 * 24 * 3600 * 1000 })
}

const check = (req, res, next) => {
  const errs = validationResult(req)
  if (errs.isEmpty()) return next()
  res.status(400).json({ message: errs.array()[0].msg })
}

// Lowercase + trim only. normalizeEmail() also strips dots from Gmail addresses, which would change real addresses.
const email = () => body('email').isString().trim().toLowerCase().isEmail().withMessage('Valid email is required').isLength({ max: 254 })

router.post('/register',
  registerLimiter,
  body('name').isString().trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name is too long'),
  email(),
  body('password').isString().isLength({ min: 8, max: 200 }).withMessage('Password must be at least 8 characters'),
  check,
  wrap(async (req, res) => {
    const { name, email: address, password } = req.body
    try {
      // Role is never read from the body: public sign-up is always a customer.
      const user = await createUser({ name, email: address, password, phone: str(req.body.phone, { max: 30, label: 'Phone' }) || null, role: 'customer' })
      setCookie(res, user)
      res.status(201).json(toPublic(user))
    } catch (e) {
      // 23505 = unique violation; checking in the DB avoids a race between two sign-ups.
      if (e.code === '23505') throw fail(409, 'Email already registered')
      throw e
    }
  }))

router.post('/login',
  loginLimiter,
  email(),
  body('password').isString().notEmpty().withMessage('Password is required'),
  check,
  wrap(async (req, res) => {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [req.body.email])
    const user = rows[0]
    // Always run one bcrypt compare so response time does not reveal whether the email exists.
    const match = await bcrypt.compare(req.body.password, user ? user.password : DUMMY_HASH)
    if (!user || !user.active || !match) throw fail(401, 'Invalid email or password')
    setCookie(res, user)
    res.json(toPublic(user))
  }))

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE)
  res.json({ ok: true })
})

router.get('/me', protect, (req, res) => res.json(toPublic(req.user)))

// Self-service profile. Role, email and branch cannot be changed here.
router.patch('/me', protect, wrap(async (req, res) => {
  const { name, phone, currentPassword, newPassword } = req.body
  const sets = []
  const vals = []
  const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`) }

  if (name !== undefined) set('name', str(name, { max: 100, label: 'Name', required: true }))
  if (phone !== undefined) set('phone', str(phone, { max: 30, label: 'Phone' }) || null)
  let changedPassword = false
  if (newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 200) throw fail(400, 'Password must be at least 8 characters')
    if (!(await bcrypt.compare(String(currentPassword || ''), req.user.password))) throw fail(400, 'Current password is wrong')
    set('password', await hashPassword(newPassword))
    sets.push('password_changed_at = now()')
    changedPassword = true
  }
  if (!sets.length) return res.json(toPublic(req.user))
  vals.push(req.user.id)
  const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals)
  if (changedPassword) setCookie(res, rows[0]) // old sessions just ended; keep this one signed in
  res.json(toPublic(rows[0]))
}))

export default router
