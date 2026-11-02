import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import { fail } from '../utils/validate.js'

// Always re-read the user: role/active changes apply immediately, never trust token claims.
// The till has its own cookie, so a till sign-in never works on dashboard routes and a dashboard sign-in never works on the till.
const guard = (cookie) => async (req, res, next) => {
  try {
    const token = req.cookies?.[cookie]
    if (!token) throw fail(401, 'Please log in')
    let claims
    try { claims = jwt.verify(token, process.env.JWT_SECRET) } catch { throw fail(401, 'Session expired, please log in') }
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [claims.id])
    const user = rows[0]
    if (!user || !user.active) throw fail(401, 'Account unavailable')
    // A password change or reset ends every session issued before it.
    if ((user.password_changed_at?.getTime() ?? 0) !== (claims.pv ?? 0)) throw fail(401, 'Your password changed. Please log in again')
    req.user = user // snake_case DB row; use req.user.branch_id for scoping
    next()
  } catch (e) { next(e) }
}
export const protect = guard('token')
export const protectTill = guard('till_token')

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(fail(403, 'Not allowed'))
