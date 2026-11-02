import { Router } from 'express'
import { query } from '../db.js'
import { protect, requireRole } from '../middleware/auth.js'
import { shiftMinutes, dayEarners } from '../utils/rules.js'
import { SHIFT } from '../utils/shifts.js'
import { asDay, fail, wrap } from '../utils/validate.js'

const router = Router()
router.use(protect)

// Times always come from the server clock; the body is never trusted for who, where or when.
const mine = requireRole('staff')

router.get('/current', mine, wrap(async (req, res) => {
  const { rows } = await query(`SELECT ${SHIFT} FROM shifts WHERE user_id = $1 AND ended_at IS NULL`, [req.user.id])
  res.json({ shift: rows[0] || null, serverNow: new Date() }) // the screen times itself against serverNow, not the tablet clock
}))

// Starting and ending shifts happens only at the till (routes/till.js); the dashboard just shows them.

// Admin: who is working right now, in every branch.
router.get('/now', requireRole('admin'), wrap(async (req, res) => {
  const { rows } = await query(
    `SELECT s.user_id AS "userId", u.name, b.area AS "branchName", s.started_at AS "startedAt"
     FROM shifts s JOIN users u ON u.id = s.user_id JOIN branches b ON b.id = s.branch_id
     WHERE s.ended_at IS NULL ORDER BY b.area, u.name`)
  res.json(rows)
}))

// ?from=&to=&userId=&branchId=  Days are UK days. Default = this month so far. Staff only ever get their own shifts.
router.get('/', requireRole('staff', 'admin'), wrap(async (req, res) => {
  const from = asDay(req.query.from, 'From')
  const to = asDay(req.query.to, 'To')
  const admin = req.user.role === 'admin'
  // ponytail: capped at 1000 rows (a month of a small team); add paging if a range ever needs more.
  const { rows } = await query(
    `SELECT s.id, s.user_id AS "userId", u.name AS "staffName", b.area AS "branchName",
            s.started_at AS "startedAt", s.ended_at AS "endedAt", s.daily_wage AS "dailyWage",
            (s.started_at AT TIME ZONE 'Europe/London')::date::text AS day
     FROM shifts s JOIN users u ON u.id = s.user_id JOIN branches b ON b.id = s.branch_id
     WHERE (s.started_at AT TIME ZONE 'Europe/London')::date
             BETWEEN COALESCE($1::date, date_trunc('month', now() AT TIME ZONE 'Europe/London')::date)
                 AND COALESCE($2::date, (now() AT TIME ZONE 'Europe/London')::date)
       AND ($3::int IS NULL OR s.user_id = $3) AND ($4::int IS NULL OR s.branch_id = $4)
     ORDER BY s.started_at DESC LIMIT 1000`,
    [from, to, admin ? Number(req.query.userId) || null : req.user.id, admin ? Number(req.query.branchId) || null : null])

  const now = new Date()
  const earners = dayEarners(rows)
  const byStaff = new Map()
  const shifts = rows.map((s) => {
    const minutes = shiftMinutes(s.startedAt, s.endedAt || now)
    // The day's pay sits on its first shift; later shifts that day show 0 and are marked so the screen can say why.
    const earns = earners.has(s.id)
    const pay = earns ? s.dailyWage : 0
    const t = byStaff.get(s.userId) || { userId: s.userId, name: s.staffName, minutes: 0, days: 0, pay: 0 }
    t.minutes += minutes
    if (earns) t.days += 1
    t.pay = Math.round((t.pay + Number(pay ?? 0)) * 100) / 100
    byStaff.set(s.userId, t)
    return { ...s, minutes, pay, earnsDay: earns, running: !s.endedAt }
  })
  const staff = [...byStaff.values()].sort((a, b) => a.name.localeCompare(b.name))
  res.json({
    shifts, staff,
    totals: { days: staff.reduce((n, t) => n + t.days, 0), minutes: staff.reduce((n, t) => n + t.minutes, 0), pay: Math.round(staff.reduce((n, t) => n + t.pay, 0) * 100) / 100 },
  })
}))

// Admin fixes a forgotten End: set when the shift really finished (and optionally started).
router.patch('/:id', requireRole('admin'), wrap(async (req, res) => {
  if (!Number.isInteger(+req.params.id)) throw fail(404, 'Shift not found')
  const when = (v, label) => {
    const d = new Date(v)
    if (!v || Number.isNaN(d.getTime())) throw fail(400, `${label} is not a valid date and time`)
    if (d > new Date()) throw fail(400, `${label} cannot be in the future`)
    return d
  }
  const endedAt = req.body.endedAt === undefined ? null : when(req.body.endedAt, 'End time')
  const startedAt = req.body.startedAt === undefined ? null : when(req.body.startedAt, 'Start time')
  if (!endedAt && !startedAt) throw fail(400, 'Nothing to change')
  try {
    const { rows } = await query(
      `UPDATE shifts SET ended_at = COALESCE($1, ended_at), started_at = COALESCE($2, started_at)
       WHERE id = $3 RETURNING ${SHIFT}`, [endedAt, startedAt, req.params.id])
    if (!rows[0]) throw fail(404, 'Shift not found')
    res.json(rows[0])
  } catch (e) {
    if (e.code === '23514') throw fail(400, 'The end must be after the start') // the shifts check constraint
    throw e
  }
}))

export default router
