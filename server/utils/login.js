import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import { fail } from './validate.js'

// One live sign-in per staff member. users.login_sid holds the id of the sign-in that is live (NULL = nobody),
// and both sign-in cookies carry that id, so a cookie whose id is no longer the current one stops working.
// Admins and customers have no login_sid and are not limited.

// The sign-in ids this browser already holds (dashboard and till cookies). Forged or expired cookies count for nothing.
function heldSids(req) {
  const held = new Set()
  for (const name of ['token', 'till_token']) {
    try { const sid = jwt.verify(req.cookies?.[name], process.env.JWT_SECRET).sid; if (sid) held.add(sid) } catch { /* not a valid cookie */ }
  }
  return held
}

// Read-only, run before the IP check so a refused attempt leaves no trace. Signing in again from the browser that
// already holds the live sign-in is allowed (the till and the dashboard on one computer are one login).
export function assertNoOtherLogin(req, user) {
  if (user.login_sid && !heldSids(req).has(user.login_sid)) {
    throw fail(409, 'Already signed in on another device. Log out there first, or ask the admin to sign you out.')
  }
}

// Takes the sign-in and returns its id. The WHERE makes it a compare-and-set, so two sign-ins arriving together
// cannot both win.
export async function claimLogin(user) {
  const sid = user.login_sid || crypto.randomBytes(16).toString('hex')
  const { rowCount } = await query('UPDATE users SET login_sid = $2 WHERE id = $1 AND login_sid IS NOT DISTINCT FROM $3', [user.id, sid, user.login_sid])
  if (!rowCount) throw fail(409, 'Already signed in on another device. Log out there first, or ask the admin to sign you out.')
  return sid
}

// Gives the sign-in up, but only if `sid` is still the live one (a stale cookie must not end a newer login).
export const releaseLogin = (userId, sid) =>
  sid ? query('UPDATE users SET login_sid = NULL WHERE id = $1 AND login_sid = $2', [userId, sid]) : Promise.resolve()

// Who a cookie belongs to, without the full guard: logout works even for an expired token.
export function claimsOf(req, cookie) {
  try { return jwt.verify(req.cookies?.[cookie], process.env.JWT_SECRET) } catch { return null }
}
