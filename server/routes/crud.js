import { Router } from 'express'
import { query } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { fail as bad, wrap } from '../utils/validate.js'

// Generic list/get/create/update/delete for the admin-managed catalogue tables.
// `fields` maps client key -> column; it is the only source of SQL identifiers, never request data.
export default function crud({ table, fields, required = [], join = '', extra = '', adminExtra = '', adminFields = {}, order = 't.id', softDelete = false, setup }) {
  const router = Router()
  const build = (cols, more) => `SELECT t.id, ${Object.entries(cols).map(([k, c]) => `t.${c} AS "${k}"`).join(', ')}${extra}${more} FROM ${table} t ${join}`
  // adminExtra / adminFields (e.g. branch staff, bought-for price) are read and written by admin only, never in the public reads.
  const writable = { ...fields, ...adminFields }
  const select = build(fields, '')
  const adminSelect = build(writable, adminExtra)
  const admin = [protect, requireRole('admin')]

  const one = async (id, admin = false) => (await query(`${admin ? adminSelect : select} WHERE t.id = $1`, [id])).rows[0]
  const idOf = (req) => {
    if (!Number.isInteger(+req.params.id)) throw bad(404, 'Not found')
    return +req.params.id
  }
  // Free text is capped so one request cannot store a huge value; the DB still enforces the real constraints.
  const checkLengths = (body) => {
    for (const k of Object.keys(writable)) if (typeof body[k] === 'string' && body[k].length > 5000) throw bad(400, `${k} is too long`)
  }

  setup?.(router) // routes that must match before /:id

  // Public sees active rows only. ?all=1 is the admin view, so it is guarded like any admin route.
  const allGuard = (req, res, next) =>
    (req.query.all ? protect(req, res, (e) => (e ? next(e) : requireRole('admin')(req, res, next))) : next())
  router.get('/', allGuard,
    wrap(async (req, res) => {
      const where = req.query.all || !('active' in fields) ? '' : 'WHERE t.active = true'
      res.json((await query(`${req.query.all ? adminSelect : select} ${where} ORDER BY ${order}`)).rows)
    }))

  router.get('/:id', wrap(async (req, res) => {
    const row = await one(idOf(req))
    if (!row || row.active === false) throw bad(404, 'Not found')
    res.json(row)
  }))

  router.post('/', ...admin, wrap(async (req, res) => {
    checkLengths(req.body)
    for (const k of required) if (req.body[k] == null || req.body[k] === '') throw bad(400, `${k} is required`)
    const keys = Object.keys(writable).filter((k) => req.body[k] !== undefined)
    const { rows } = await query(
      `INSERT INTO ${table} (${keys.map((k) => writable[k]).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      keys.map((k) => req.body[k]),
    )
    res.status(201).json(await one(rows[0].id, true))
  }))

  router.put('/:id', ...admin, wrap(async (req, res) => {
    const id = idOf(req)
    checkLengths(req.body)
    for (const k of required) if (req.body[k] === '' || req.body[k] === null) throw bad(400, `${k} is required`)
    const keys = Object.keys(writable).filter((k) => req.body[k] !== undefined)
    if (keys.length) {
      const { rowCount } = await query(
        `UPDATE ${table} SET ${keys.map((k, i) => `${writable[k]} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}`,
        [...keys.map((k) => req.body[k]), id],
      )
      if (!rowCount) throw bad(404, 'Not found')
    }
    const row = await one(id, true)
    if (!row) throw bad(404, 'Not found')
    res.json(row)
  }))

  // Products are hidden, not deleted, so past orders keep their history. Others refuse if in use (FK -> 409).
  router.delete('/:id', ...admin, wrap(async (req, res) => {
    const sql = softDelete ? `UPDATE ${table} SET active = false WHERE id = $1` : `DELETE FROM ${table} WHERE id = $1`
    const { rowCount } = await query(sql, [idOf(req)])
    if (!rowCount) throw bad(404, 'Not found')
    res.json({ ok: true })
  }))

  return router
}
