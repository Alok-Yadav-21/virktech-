import { Router } from 'express'
import { query, tx } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { postLoyalty } from '../utils/loyalty.js'
import { findRepairs } from '../utils/repairs.js'
import { redemption, quoteSent, REPAIR_STATUS as S } from '../utils/rules.js'
import { fail, str, wrap } from '../utils/validate.js'

const router = Router()
router.use(protect)

const staffOnly = requireRole('staff', 'admin')

router.get('/me', wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT id, delta, kind, source_ref AS "sourceRef", note, created_at AS "createdAt"
     FROM loyalty_entries WHERE user_id = $1 ORDER BY id DESC LIMIT 100`, [req.user.id])
  const { rows: [me] } = await query('SELECT loyalty_points FROM users WHERE id = $1', [req.user.id])
  res.json({ balance: me.loyalty_points, entries: rows })
}))

// Find the named customer by email (counter staff and admin).
router.get('/lookup', staffOnly, wrap(async (req, res) => {
  const { rows } = await query(
    "SELECT id, name, email, loyalty_points AS \"loyaltyPoints\" FROM users WHERE email = lower($1) AND role = 'customer' AND active = true",
    [String(req.query.email || '').trim()])
  if (!rows[0]) throw fail(404, 'No customer with that email')
  res.json(rows[0])
}))

// Counter redemption for a named customer, against a repair's quote or a till bill amount.
router.post('/redeem', staffOnly, wrap(async (req, res) => {
  const { customerId, points: requested, repairRef, billAmount } = req.body
  const { rows: [customer] } = await query("SELECT id FROM users WHERE id = $1 AND role = 'customer' AND active = true", [customerId])
  if (!customer) throw fail(404, 'Customer not found')

  let repair = null
  let bill = Number(billAmount)
  if (repairRef) {
    ;[repair] = await findRepairs(req.user, { ref: repairRef }) // branch scope applies to staff
    if (!repair || repair.customer_id !== customer.id) throw fail(404, 'Repair not found for this customer')
    if (!quoteSent({ status: repair.status, history: repair.history })) throw fail(400, 'The quote has not been sent yet')
    if (repair.status === S.COMPLETED || repair.status === S.CANCELLED) throw fail(400, 'This repair is closed')
    if (repair.loyalty_discount > 0) throw fail(409, 'Points were already used on this repair')
    bill = repair.quote
  }
  if (!(bill > 0)) throw fail(400, 'Enter the bill amount')

  const result = await tx(async (db) => {
    const { rows: [u] } = await db.query('SELECT loyalty_points FROM users WHERE id = $1 FOR UPDATE', [customer.id])
    const { points, discount } = redemption({ requested, balance: u.loyalty_points, bill })
    if (!points) throw fail(400, 'No points can be used: needs 10+ points and a bill of at least £10')
    const balance = await postLoyalty(db, customer.id, -points, 'redeemed', repairRef || 'COUNTER', `Counter redemption by ${req.user.name}`)
    if (repair) {
      const { rowCount } = await db.query('UPDATE repairs SET loyalty_discount = $1 WHERE reference = $2 AND loyalty_discount = 0', [discount, repair.reference])
      if (!rowCount) throw fail(409, 'Points were already used on this repair')
    }
    return { points, discount, balance }
  })
  res.json(result)
}))

router.post('/adjust', requireRole('admin'), wrap(async (req, res) => {
  const { userId, delta, note } = req.body
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000) throw fail(400, 'Enter a whole number of points, not zero')
  const cleanNote = str(note, { max: 300, label: 'A note', required: true })
  const { rows: [user] } = await query("SELECT id FROM users WHERE id = $1 AND role = 'customer'", [userId])
  if (!user) throw fail(404, 'Customer not found')
  const balance = await tx((db) => postLoyalty(db, user.id, delta, 'adjusted', 'ADMIN', `${cleanNote} (by ${req.user.name})`))
  res.json({ balance })
}))

export default router
