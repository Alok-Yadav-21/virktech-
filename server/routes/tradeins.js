import { Router } from 'express'
import { query } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { nextReference } from '../utils/reference.js'
import { findTradeIns, toTradeIn, forRules } from '../utils/tradeins.js'
import { pageOf, sendPage } from '../utils/paging.js'
import { fail, str, wrap } from '../utils/validate.js'
import { TRADEIN_STATUS as T, TRADEIN_STATUSES, TRADEIN_CONDITIONS, tradeInChangeError, tradeInEditable } from '../utils/rules.js'

const router = Router()
router.use(protect)

const entry = (req, status) => ({ status, at: new Date().toISOString(), by: req.user.name })

// Out-of-scope refs get 404, not 403, so a reference never confirms a stranger's trade-in exists.
async function load(req) {
  const [row] = await findTradeIns(req.user, { ref: req.params.ref })
  if (!row) throw fail(404, 'Trade-in not found')
  return row
}
const respond = async (req, res, status = 200) => res.status(status).json(toTradeIn(await load(req), req.user.role))

// Optional links only (no uploads). http(s) only, so a stored value is never a javascript: URL.
function cleanPhotos(photos) {
  if (photos === undefined) return []
  if (!Array.isArray(photos) || photos.length > 5) throw fail(400, 'Add up to 5 photo links')
  return photos.map((p) => str(p, { max: 500, label: 'Photo link' })).filter(Boolean).map((u) => {
    if (!/^https?:\/\/\S{1,500}$/i.test(u)) throw fail(400, 'Photo links must start with http:// or https://')
    return u
  })
}

router.post('/', requireRole('customer'), wrap(async (req, res) => {
  const { branchId, device = {}, condition, details, photos } = req.body
  const model = str(device.model, { max: 100, label: 'Device model', required: true })
  if (!TRADEIN_CONDITIONS.includes(condition)) throw fail(400, 'Choose the device condition')
  const cleaned = cleanPhotos(photos)
  if (!(await query('SELECT 1 FROM branches WHERE id = $1 AND active = true', [branchId])).rowCount) throw fail(400, 'Choose a branch')

  const reference = await nextReference('TI')
  await query(
    `INSERT INTO trade_ins (reference, customer_id, branch_id, device_category, device_brand, device_model, condition, details, photos, history)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [reference, req.user.id, branchId, str(device.category, { max: 50, label: 'Device type' }) || null, str(device.brand, { max: 100, label: 'Brand' }) || null, model,
      condition, str(details, { max: 2000, label: 'Details' }) || null, JSON.stringify(cleaned), JSON.stringify([entry(req, T.SUBMITTED)])])
  req.params.ref = reference
  await respond(req, res, 201)
}))

// ?status=&q=&limit=&offset= ; the full match count comes back in X-Total-Count.
router.get('/', wrap(async (req, res) => {
  const status = TRADEIN_STATUSES.includes(req.query.status) ? req.query.status : undefined
  const rows = await findTradeIns(req.user, { status, q: req.query.q, ...pageOf(req) })
  sendPage(res, rows, (t) => toTradeIn(t, req.user.role))
}))
router.get('/:ref', wrap(respond))

// Staff: set the guide value / offer and/or move the status in one call.
router.patch('/:ref', requireRole('staff', 'admin'), wrap(async (req, res) => {
  const t = await load(req)
  const { indicativeValue, finalOffer, status } = req.body
  let indicative = t.indicative_value
  let offer = t.final_offer

  if (indicativeValue !== undefined || finalOffer !== undefined) {
    // Once the offer has been sent, or the trade-in is over, the numbers cannot quietly change.
    if (!tradeInEditable(forRules(t))) throw fail(409, 'The offer has been sent or this trade-in is closed')
    if (indicativeValue !== undefined) {
      if (indicativeValue !== null && !(Number(indicativeValue) >= 0)) throw fail(400, 'Guide value must be zero or more')
      indicative = indicativeValue === null ? null : Number(indicativeValue)
    }
    if (finalOffer !== undefined) {
      if (finalOffer !== null && !(Number(finalOffer) > 0)) throw fail(400, 'Offer must be more than zero')
      offer = finalOffer === null ? null : Number(finalOffer)
    }
  }

  let history = []
  if (status !== undefined && status !== t.status) {
    const error = tradeInChangeError({ ...forRules(t), finalOffer: offer }, status, 'staff')
    if (error) throw fail(400, error)
    history = [entry(req, status)]
  }

  // Matching on the old status makes two simultaneous updates safe: the second one finds 0 rows.
  const { rowCount } = await query(
    `UPDATE trade_ins SET indicative_value = $1, final_offer = $2, status = $3, history = history || $4::jsonb, updated_at = now()
     WHERE reference = $5 AND status = $6`,
    [indicative, offer, history[0]?.status || t.status, JSON.stringify(history), t.reference, t.status])
  if (!rowCount) throw fail(409, 'This trade-in was just updated by someone else. Reload and try again.')
  await respond(req, res)
}))

// Customer: accept or decline the offer, or withdraw a request nobody has started on.
router.post('/:ref/respond', requireRole('customer'), wrap(async (req, res) => {
  const t = await load(req)
  const to = { accept: T.ACCEPTED, decline: T.DECLINED, cancel: T.CANCELLED }[req.body.action]
  if (!to) throw fail(400, 'Choose accept, decline or cancel')
  const error = tradeInChangeError(forRules(t), to, 'customer')
  if (error) throw fail(400, error)
  const { rowCount } = await query(
    "UPDATE trade_ins SET status = $1, history = history || $2::jsonb, updated_at = now() WHERE reference = $3 AND status = $4",
    [to, JSON.stringify([entry(req, to)]), t.reference, t.status])
  if (!rowCount) throw fail(409, 'This trade-in was just updated. Reload and try again.')
  await respond(req, res)
}))

export default router
