import { query } from '../db.js'

// Staff sign in at the branch whose saved IP matches the caller. supertest always arrives from 127.0.0.1, so before each
// PIN sign-in the test points that IP at the branch the staff member belongs to (one IP, one branch: clear first).
// It also frees the member's live sign-in: tests start a fresh browser for the same person again and again, which the
// one-login-at-a-time rule would otherwise refuse. The rule itself is tested in login.test.js.
// The dashboard sign-in cookie value out of a login response. A staff member has one live sign-in, but one browser may
// hold it twice (dashboard and till, as on a shop computer). A test builds the "same browser" by sending this cookie
// along with the till sign-in; the agent keeps only what the server sets back, so each agent holds one cookie.
export const tokenOf = (res) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('token='))?.split(';')[0].slice(6)

// Pass { keepLogin: true } to only move the IP, for a second sign-in by someone who is already signed in (see tokenOf).
// The branch to pick when signing a test user in (staff always say which branch they are at).
export async function branchOf(pin) {
  return (await query("SELECT branch_id FROM users WHERE pin = $1 AND role = 'staff'", [String(pin)])).rows[0]?.branch_id ?? null
}

export async function atPinBranch(pin, { keepLogin = false } = {}) {
  if (!keepLogin) await query("UPDATE users SET login_sid = NULL WHERE pin = $1 AND role = 'staff'", [String(pin)])
  const { rows: [u] } = await query("SELECT branch_id FROM users WHERE pin = $1 AND role = 'staff'", [String(pin)])
  if (!u?.branch_id) return
  await query('UPDATE branches SET ip = NULL') // one IP, one branch: clear first so two rows never hold it at once
  await query("UPDATE branches SET ip = '127.0.0.1' WHERE id = $1", [u.branch_id])
}
