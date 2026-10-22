import { fail } from './validate.js'

// WHERE fragment limiting rows to what this user may see: customer = own, staff = own branch, admin = all.
// Every list/get query goes through this; never filter by an id the client sent.
// Staff with no branch get `branch_id = NULL`, which matches nothing (fails closed).
export function scopeClause(user, { customer = 'customer_id', branch = 'branch_id' } = {}, startAt = 1) {
  if (user.role === 'admin') return { sql: 'TRUE', params: [] }
  if (user.role === 'staff') return { sql: `${branch} = $${startAt}`, params: [user.branch_id] }
  return { sql: `${customer} = $${startAt}`, params: [user.id] }
}

// The branch a staff/admin write applies to. Staff work on their own branch only; admin must name one.
export function branchFor(req) {
  const asked = Number(req.query.branchId ?? req.body?.branchId)
  if (req.user.role === 'staff') {
    if (Number.isFinite(asked) && asked !== req.user.branch_id) throw fail(403, 'You can only manage your own branch')
    return req.user.branch_id
  }
  if (!Number.isInteger(asked)) throw fail(400, 'Choose a branch')
  return asked
}
