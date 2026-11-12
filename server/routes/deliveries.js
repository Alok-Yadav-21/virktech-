import { Router } from 'express'
import { tx } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { fail, wrap } from '../utils/validate.js'
import { branchFor } from '../utils/scope.js'
import { pageOf, sendPage } from '../utils/paging.js'
import { stockDeltas } from '../utils/rules.js'
import { findDeliveries, toDelivery, itemsOf, readHead, readItems, checkProducts, applyDeltas, writeItems, receiveDelivery } from '../utils/deliveries.js'

const router = Router()
router.use(protect, requireRole('staff', 'admin'))

// Out-of-scope ids get 404, like orders and repairs.
async function load(req) {
  const id = Number(req.params.id)
  const [row] = Number.isInteger(id) ? await findDeliveries(req.user, { id, today: req.user.role === 'staff' }) : []
  if (!row) throw fail(404, 'Delivery not found')
  return row
}
const respond = async (req, res, id, status = 200) => {
  const [row] = await findDeliveries(req.user, { id })
  res.status(status).json({ ...toDelivery(row), items: await itemsOf(id) })
}

router.get('/', wrap(async (req, res) => {
  const { limit, offset } = pageOf(req)
  sendPage(res, await findDeliveries(req.user, { q: req.query.q, today: req.user.role === 'staff', limit, offset }), toDelivery)
}))

router.get('/:id', wrap(async (req, res) => respond(req, res, (await load(req)).id)))

// Receiving a delivery records it AND adds the pieces to that branch's stock, all or nothing.
router.post('/', wrap(async (req, res) => {
  const id = await receiveDelivery(req.user, branchFor(req), req.body)
  await respond(req, res, id, 201)
}))

// Editing changes stock by the difference only (10 -> 12 adds 2). The branch cannot change.
router.put('/:id', wrap(async (req, res) => {
  const cur = await load(req)
  const head = readHead(req.body)
  const items = readItems(req.body.items)
  await checkProducts(items)
  await tx(async (db) => {
    await db.query('SELECT 1 FROM deliveries WHERE id = $1 FOR UPDATE', [cur.id])
    const old = await itemsOf(cur.id, db)
    await applyDeltas(db, cur.branch_id, stockDeltas(old, items))
    await db.query('UPDATE deliveries SET supplier = $2, received_on = $3, note = $4, updated_at = now() WHERE id = $1', [cur.id, head.supplier, head.receivedOn, head.note])
    await writeItems(db, cur.id, items)
  })
  await respond(req, res, cur.id)
}))

// Deleting takes the pieces back out of stock. If some were already sold it is refused (409).
router.delete('/:id', wrap(async (req, res) => {
  const cur = await load(req)
  await tx(async (db) => {
    await db.query('SELECT 1 FROM deliveries WHERE id = $1 FOR UPDATE', [cur.id])
    await applyDeltas(db, cur.branch_id, stockDeltas(await itemsOf(cur.id, db), []))
    await db.query('DELETE FROM deliveries WHERE id = $1', [cur.id])
  })
  res.status(204).end()
}))

export default router
