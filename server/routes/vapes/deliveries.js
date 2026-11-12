import { Router } from 'express'
import { tx } from '../../db.js'
import { protect, requireRole } from '../../middleware/auth.js'
import { fail, wrap } from '../../utils/validate.js'
import { branchFor } from '../../utils/scope.js'
import { pageOf, sendPage } from '../../utils/paging.js'
import { stockDeltas } from '../../utils/rules.js'
import { toDelivery, readHead, readItems } from '../../utils/deliveries.js'
import { findVapeDeliveries, vapeItemsOf, checkVapeProducts, applyVapeDeltas, writeVapeItems, receiveVapeDelivery } from '../../utils/vapeDeliveries.js'

const router = Router()
router.use(protect, requireRole('staff', 'admin'))

async function load(req) {
  const id = Number(req.params.id)
  const [row] = Number.isInteger(id) ? await findVapeDeliveries(req.user, { id, today: req.user.role === 'staff' }) : []
  if (!row) throw fail(404, 'Delivery not found')
  return row
}
const respond = async (req, res, id, status = 200) => {
  const [row] = await findVapeDeliveries(req.user, { id })
  res.status(status).json({ ...toDelivery(row), items: await vapeItemsOf(id) })
}

router.get('/', wrap(async (req, res) => {
  const { limit, offset } = pageOf(req)
  sendPage(res, await findVapeDeliveries(req.user, { q: req.query.q, today: req.user.role === 'staff', limit, offset }), toDelivery)
}))

router.get('/:id', wrap(async (req, res) => respond(req, res, (await load(req)).id)))

// Receiving a delivery records it AND adds the pieces to that branch's vape stock, all or nothing.
router.post('/', wrap(async (req, res) => {
  const id = await receiveVapeDelivery(req.user, branchFor(req), req.body)
  await respond(req, res, id, 201)
}))

// Editing changes stock by the difference only. The branch cannot change.
router.put('/:id', wrap(async (req, res) => {
  const cur = await load(req)
  const head = readHead(req.body)
  const items = readItems(req.body.items)
  await checkVapeProducts(items)
  await tx(async (db) => {
    await db.query('SELECT 1 FROM vape_deliveries WHERE id = $1 FOR UPDATE', [cur.id])
    const old = await vapeItemsOf(cur.id, db)
    await applyVapeDeltas(db, cur.branch_id, stockDeltas(old, items))
    await db.query('UPDATE vape_deliveries SET supplier = $2, received_on = $3, note = $4, updated_at = now() WHERE id = $1', [cur.id, head.supplier, head.receivedOn, head.note])
    await writeVapeItems(db, cur.id, items)
  })
  await respond(req, res, cur.id)
}))

// Deleting takes the pieces back out of stock; refused (409) if some were already sold.
router.delete('/:id', wrap(async (req, res) => {
  const cur = await load(req)
  await tx(async (db) => {
    await db.query('SELECT 1 FROM vape_deliveries WHERE id = $1 FOR UPDATE', [cur.id])
    await applyVapeDeltas(db, cur.branch_id, stockDeltas(await vapeItemsOf(cur.id, db), []))
    await db.query('DELETE FROM vape_deliveries WHERE id = $1', [cur.id])
  })
  res.status(204).end()
}))

export default router
