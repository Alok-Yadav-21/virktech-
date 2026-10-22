import { Router } from 'express'
import { query, tx } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { nextReference } from '../utils/reference.js'
import { awardRepairPoints, postLoyalty } from '../utils/loyalty.js'
import { findRepairs, toRepair } from '../utils/repairs.js'
import { pageOf, sendPage } from '../utils/paging.js'
import { fail, str, wrap } from '../utils/validate.js'
import {
  REPAIR_STATUS as S, FULFILMENT, pointsForDiscount, REPAIR_STATUSES, statusChangeError, repairPayError, repairAmountDue, quoteSent,
} from '../utils/rules.js'

const router = Router()
router.use(protect)

const actorOf = (user) => (user.role === 'customer' ? 'customer' : 'staff')
const staffOnly = requireRole('staff', 'admin')
const stamp = (req, extra) => ({ at: new Date().toISOString(), by: req.user.name, ...extra })
// The rules read the same names the client sees, so adapt the DB row once.
const forRules = (r) => ({ status: r.status, quote: r.quote, history: r.history, paymentStatus: r.payment_status, loyaltyDiscount: r.loyalty_discount })

// Out-of-scope refs get 404, not 403, so a reference number never confirms a stranger's repair exists.
async function load(req) {
  const [row] = await findRepairs(req.user, { ref: req.params.ref })
  if (!row) throw fail(404, 'Repair not found')
  return row
}
const respond = async (req, res, status = 200) => res.status(status).json(toRepair(await load(req), req.user.role))
const stale = () => fail(409, 'This repair was just updated by someone else. Reload and try again.')

router.post('/', requireRole('customer'), wrap(async (req, res) => {
  const { branchId, device = {}, fulfilment } = req.body
  const model = str(device.model, { max: 100, label: 'Device model', required: true })
  const problem = str(req.body.problem, { max: 2000, label: 'The problem description', required: true })
  if (!FULFILMENT.includes(fulfilment)) throw fail(400, 'Choose how the device reaches us')
  if (!(await query('SELECT 1 FROM branches WHERE id = $1 AND active = true', [branchId])).rowCount) throw fail(400, 'Choose a branch')

  const reference = await nextReference('SPR')
  await query(
    `INSERT INTO repairs (reference, customer_id, branch_id, device_category, device_brand, device_model, problem, fulfilment, history)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [reference, req.user.id, branchId, str(device.category, { max: 50, label: 'Device type' }) || null, str(device.brand, { max: 100, label: 'Brand' }) || null,
      model, problem, fulfilment, JSON.stringify([stamp(req, { status: S.BOOKED })])])
  req.params.ref = reference
  await respond(req, res, 201)
}))

// ?status=&q=&limit=&offset= ; the full match count comes back in X-Total-Count.
router.get('/', wrap(async (req, res) => {
  const status = REPAIR_STATUSES.includes(req.query.status) ? req.query.status : undefined
  const rows = await findRepairs(req.user, { status, q: req.query.q, ...pageOf(req) })
  sendPage(res, rows, (r) => toRepair(r, req.user.role))
}))

router.get('/:ref', wrap(respond))

router.patch('/:ref/status', wrap(async (req, res) => {
  const repair = await load(req)
  const to = req.body.status
  let reason = str(req.body.reason, { max: 500, label: 'Reason' })
  const actor = actorOf(req.user)
  // Declining a quote is a cancel, but the customer should not have to invent a reason.
  if (actor === 'customer' && repair.status === S.QUOTE && to === S.CANCELLED && !reason) reason = 'Customer declined the quote'
  const error = statusChangeError(forRules(repair), to, actor, reason)
  if (error) throw fail(400, error)

  const entry = stamp(req, { status: to, ...(reason && { reason }) })
  // Matching on the old status makes two simultaneous updates safe: the second one finds 0 rows.
  await tx(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE repairs SET status = $1, history = history || $2::jsonb, cancel_reason = COALESCE($3, cancel_reason), updated_at = now(),
         payment_status = CASE WHEN $1 = 'Cancelled' AND payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE reference = $4 AND status = $5`,
      [to, JSON.stringify([entry]), to === S.CANCELLED ? reason : null, repair.reference, repair.status])
    if (!rowCount) throw stale()
    if (to === S.COMPLETED) await awardRepairPoints(db, repair.reference)
    // Points spent at the counter on a repair that never happened come back.
    if (to === S.CANCELLED && repair.loyalty_discount > 0) {
      await postLoyalty(db, repair.customer_id, pointsForDiscount(repair.loyalty_discount), 'adjusted', repair.reference, 'Refund: repair cancelled')
    }
  })
  await respond(req, res)
}))

router.patch('/:ref/quote', staffOnly, wrap(async (req, res) => {
  const repair = await load(req)
  const quote = Number(req.body.quote)
  if (!(quote > 0) || quote > 100000) throw fail(400, 'Quote must be more than zero')
  // After the customer has seen a quote it cannot be quietly changed.
  if (quoteSent(forRules(repair))) throw fail(409, 'The quote has already been sent to the customer')
  if (repair.status === S.COMPLETED || repair.status === S.CANCELLED) throw fail(409, 'This repair is closed')
  await query('UPDATE repairs SET quote = $1, updated_at = now() WHERE reference = $2', [quote, repair.reference])
  await respond(req, res)
}))

// Taking payment at the counter. Amount is fixed here: quote less any loyalty discount.
router.patch('/:ref/pay', staffOnly, wrap(async (req, res) => {
  const repair = await load(req)
  const error = repairPayError(forRules(repair))
  if (error) throw fail(400, error)
  const amount = repairAmountDue(forRules(repair))
  const entry = stamp(req, { status: repair.status, reason: `Marked as paid (£${amount.toFixed(2)})` })
  const { rowCount } = await query(
    `UPDATE repairs SET payment_status = 'paid', paid_at = now(), paid_amount = $1, history = history || $2::jsonb, updated_at = now()
     WHERE reference = $3 AND payment_status = 'unpaid' AND status = $4`,
    [amount, JSON.stringify([entry]), repair.reference, repair.status])
  if (!rowCount) throw stale()
  await respond(req, res)
}))

router.patch('/:ref/technician', requireRole('admin'), wrap(async (req, res) => {
  const repair = await load(req)
  const id = req.body.technicianId
  if (id !== null) {
    const { rowCount } = await query(
      "SELECT 1 FROM users WHERE id = $1 AND role = 'staff' AND active = true AND branch_id = $2", [id, repair.branch_id])
    if (!rowCount) throw fail(400, 'Choose an active staff member from this repair\'s branch')
  }
  await query('UPDATE repairs SET technician_id = $1, updated_at = now() WHERE reference = $2', [id, repair.reference])
  await respond(req, res)
}))

router.post('/:ref/notes', staffOnly, wrap(async (req, res) => {
  const repair = await load(req)
  const note = { by: req.user.name, text: str(req.body.text, { max: 2000, label: 'Note', required: true }), visibleToCustomer: req.body.visibleToCustomer === true, at: new Date().toISOString() }
  await query('UPDATE repairs SET notes = notes || $1::jsonb, updated_at = now() WHERE reference = $2', [JSON.stringify([note]), repair.reference])
  await respond(req, res, 201)
}))

router.post('/:ref/parts', staffOnly, wrap(async (req, res) => {
  const repair = await load(req)
  const cost = Number(req.body.cost)
  const name = str(req.body.name, { max: 200, label: 'Part name', required: true })
  if (!(cost >= 0) || cost > 100000) throw fail(400, 'Part cost must be zero or more')
  await query('UPDATE repairs SET parts = parts || $1::jsonb, updated_at = now() WHERE reference = $2', [JSON.stringify([{ name, cost }]), repair.reference])
  await respond(req, res, 201)
}))

export default router
