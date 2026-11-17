import { query } from '../db.js'

// Tests sign in from one address, so before a staff sign-in point the shop IP at that person's branch.
// (users.branch_id is where a test put them; the real sign-in then confirms it.)
export async function atPinBranch(pin) {
  const { rows: [u] } = await query("SELECT branch_id FROM users WHERE pin = $1 AND role = 'staff'", [String(pin)])
  if (!u?.branch_id) return
  await query('UPDATE branches SET ip = NULL') // one IP, one branch: clear first so two rows never hold it at once
  await query("UPDATE branches SET ip = '127.0.0.1' WHERE id = $1", [u.branch_id])
}
