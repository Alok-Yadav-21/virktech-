import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import { atPinBranch } from './test/atBranch.js'
import pool, { query } from './db.js'
import { createUser } from './utils/users.js'

// Start/end a shift, who can see which hours, and a day's pay from the rate stored on the shift.
const PW = 'Password123!'
const PINS = { a: '9101', b: '9102' }
const as = {}
const till = {} // each person's own till sign-in: shifts start and end only at the till
let blv, sid, idA, idB

const loginPin = async (pin) => {
  const agent = request.agent(app)
  await atPinBranch(pin)
  expect((await agent.post('/api/auth/pin-login').send({ pin })).status).toBe(200)
  return agent
}
const clock = (who, pin, action, extra = {}) => till[who].post('/api/till/clock').send({ pin, action, ...extra })
// Staff have no shifts route any more, so read the open shift straight from the database.
const current = async (who) => (await query(
  'SELECT id, user_id AS "userId", started_at AS "startedAt", daily_wage::float AS "dailyWage" FROM shifts WHERE user_id = $1 AND ended_at IS NULL',
  [who === 'a' ? idA : idB])).rows[0] ?? null
const cleanup = async () => {
  await query('DELETE FROM shifts WHERE user_id IN (SELECT id FROM users WHERE pin = ANY($1))', [Object.values(PINS)])
  await query('DELETE FROM users WHERE pin = ANY($1)', [Object.values(PINS)])
}

beforeAll(async () => {
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  sid = (await query("SELECT id FROM branches WHERE area = 'Sidcup'")).rows[0].id
  await cleanup()
  idA = (await createUser({ name: 'Shift A', role: 'staff', branchId: blv, pin: PINS.a, dailyWage: 10 })).id
  idB = (await createUser({ name: 'Shift B', role: 'staff', branchId: sid, pin: PINS.b, dailyWage: 20 })).id
  as.a = await loginPin(PINS.a)
  as.b = await loginPin(PINS.b)
  for (const w of ['a', 'b']) {
    till[w] = request.agent(app)
    await atPinBranch(PINS[w])
    expect((await till[w].post('/api/till/login').send({ pin: PINS[w] })).status).toBe(200)
  }
  as.admin = request.agent(app)
  expect((await as.admin.post('/api/auth/login').send({ email: 'admin@demo.com', password: PW })).status).toBe(200)
  as.customer = request.agent(app)
  expect((await as.customer.post('/api/auth/login').send({ email: 'customer@demo.com', password: PW })).status).toBe(200)
})

afterAll(async () => { await cleanup(); await pool.end() })

test('start, one at a time, end', async () => {
  expect(await current('a')).toBeNull()
  expect((await clock('a', PINS.a, 'end')).status, 'nothing to end').toBe(409)

  const started = await clock('a', PINS.a, 'start', { userId: idB, startedAt: '2000-01-01' }) // extra body fields are ignored
  expect(started.status).toBe(200)
  const shift = await current('a')
  expect(shift).toMatchObject({ userId: idA, dailyWage: 10 })
  expect(new Date(shift.startedAt).getFullYear(), 'server clock, not the body').toBeGreaterThan(2020)
  expect((await clock('a', PINS.a, 'start')).status, 'second start').toBe(409)

  expect((await clock('a', PINS.a, 'end')).status).toBe(200)
  const t1 = await clock('a', PINS.a, 'toggle')
  expect(t1.body.action, 'toggle starts when off').toBe('start')
  expect((await clock('a', PINS.a, 'toggle')).body.action, 'toggle ends when on').toBe('end')
  expect(await current('a')).toBeNull()
  expect((await clock('a', PINS.a, 'end')).status, 'already ended').toBe(409)
})

test('only staff run shifts', async () => {
  for (const who of ['a', 'admin', 'customer']) { // the dashboard can no longer start or end a shift at all
    expect((await as[who].post('/api/shifts/start')).status).toBe(404)
    expect((await as[who].post('/api/shifts/end')).status).toBe(404)
  }
  for (const who of ['a', 'customer']) { // staff never see hours or wages, not even their own
    expect((await as[who].get('/api/shifts')).status, who).toBe(403)
    expect((await as[who].get('/api/shifts/current')).status, who).toBe(404)
  }
  expect((await request(app).get('/api/shifts')).status).toBe(401)
})

test('admin sees all hours and can filter', async () => {
  await clock('b', PINS.b, 'start')
  await clock('b', PINS.b, 'end')

  const all = (await as.admin.get('/api/shifts')).body
  expect(all.staff.map((t) => t.userId)).toEqual(expect.arrayContaining([idA, idB]))
  expect((await as.admin.get(`/api/shifts?userId=${idB}`)).body.shifts.every((s) => s.userId === idB)).toBe(true)
  expect((await as.admin.get(`/api/shifts?branchId=${sid}`)).body.shifts.every((s) => s.branchName === 'Sidcup')).toBe(true)
  expect((await as.admin.get('/api/shifts?from=nope')).status).toBe(400)
  expect((await as.admin.get('/api/shifts?from=2001-01-01&to=2001-01-31')).body.shifts, 'outside the range').toEqual([])
})

test('a day pays the rate stored on the shift, and admin can fix a forgotten end', async () => {
  await query('DELETE FROM shifts WHERE user_id = $1', [idA])
  expect((await clock('a', PINS.a, 'start')).status).toBe(200)
  const id = (await current('a')).id
  await query("UPDATE users SET daily_wage = 99 WHERE id = $1", [idA]) // a later raise must not change this shift
  const hoursAgo = (h) => new Date(Date.now() - h * 3600_000)
  await query('UPDATE shifts SET started_at = $1 WHERE id = $2', [hoursAgo(3), id]) // the person forgot to press End

  const running = (await as.admin.get(`/api/shifts?userId=${idA}`)).body.shifts.find((s) => s.id === id)
  expect(running).toMatchObject({ running: true, dailyWage: 10 })
  expect(running.minutes).toBeGreaterThanOrEqual(180)

  expect((await as.a.patch(`/api/shifts/${id}`).send({ endedAt: hoursAgo(1) })).status, 'staff cannot edit').toBe(403)
  expect((await as.admin.patch(`/api/shifts/${id}`).send({ endedAt: hoursAgo(5) })).status, 'end before start').toBe(400)
  expect((await as.admin.patch(`/api/shifts/${id}`).send({ endedAt: new Date(Date.now() + 3600_000) })).status, 'future').toBe(400)
  expect((await as.admin.patch(`/api/shifts/${id}`).send({ endedAt: 'nope' })).status).toBe(400)
  expect((await as.admin.patch(`/api/shifts/${id}`).send({})).status).toBe(400)
  expect((await as.admin.patch('/api/shifts/999999').send({ endedAt: hoursAgo(1) })).status).toBe(404)
  expect((await as.admin.patch(`/api/shifts/${id}`).send({ endedAt: hoursAgo(1) })).status).toBe(200)

  const fixed = (await as.admin.get(`/api/shifts?userId=${idA}`)).body
  const row = fixed.shifts.find((s) => s.id === id)
  expect(row).toMatchObject({ running: false, minutes: 120, pay: 10, earnsDay: true }) // a whole day at the old £10 rate, not 2 hours of it
  expect(fixed.totals).toMatchObject({ days: 1, minutes: 120, pay: 10 })

  // A second shift the same day adds hours but no pay.
  expect((await clock('a', PINS.a, 'start')).status).toBe(200)
  const second = (await current('a')).id
  await query("UPDATE shifts SET started_at = (SELECT started_at FROM shifts WHERE id = $1) + interval '30 minutes' WHERE id = $2", [id, second]) // same UK day, even if this runs just after midnight
  const again = (await as.admin.get(`/api/shifts?userId=${idA}`)).body
  expect(again.totals).toMatchObject({ days: 1, pay: 10 })
  expect(again.shifts.filter((x) => x.earnsDay)).toHaveLength(1)
  await clock('a', PINS.a, 'end')
})

test('a deactivated staff member is locked out at once', async () => {
  await query('UPDATE users SET active = false WHERE id = $1', [idB])
  expect((await clock('b', PINS.b, 'start')).status).toBe(401)
})

test('the till stays open for the people still on shift when the first one leaves', async () => {
  const c = await createUser({ name: 'Shift C', role: 'staff', branchId: blv, pin: '7782', dailyWage: 10 })
  try {
    expect((await clock('a', PINS.a, 'start')).status).toBe(200)
    expect((await clock('a', '7782', 'start')).body.holder.name, 'holder still on shift').toBe('Shift A')
    const left = await clock('a', PINS.a, 'end') // the person who opened the till leaves first
    expect(left.body.holder.name, 'till passes to the one still working').toBe('Shift C')
    const me = await till.a.get('/api/till/me') // same cookie jar, no new sign-in
    expect(me.body).toMatchObject({ name: 'Shift C', onShift: true })
    const last = await clock('a', '7782', 'end')
    expect(last.status).toBe(200)
    expect((await till.a.get('/api/till/me')).body.onShift, 'nobody on shift: locked').toBe(false)
    expect((await clock('a', PINS.a, 'start')).body.holder.name, 'a new start takes the till').toBe('Shift A')
    expect((await till.a.get('/api/till/me')).body).toMatchObject({ name: 'Shift A', onShift: true })
  } finally {
    await query('DELETE FROM shifts WHERE user_id = ANY($1)', [[c.id, idA]])
    await query('DELETE FROM users WHERE id = $1', [c.id])
  }
})
