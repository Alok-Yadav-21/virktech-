import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import pool, { query } from './db.js'
import { createUser } from './utils/users.js'

// 6-digit staff PINs, and one live sign-in per staff member (utils/login.js). Each test takes its own browsers
// (request.agent keeps cookies), so "another device" is simply a second agent.
const PW = 'Password123!'
const PIN = '880011'
const NEW_PIN = '880022'
let blv, id, admin

const cleanup = () => query('DELETE FROM users WHERE pin = ANY($1)', [[PIN, NEW_PIN]])
// Staff arrive from 127.0.0.1 in tests; point that IP at their branch the way a real shop would have it saved.
const atBranch = async () => { await query('UPDATE branches SET ip = NULL'); await query("UPDATE branches SET ip = '127.0.0.1' WHERE id = $1", [blv]) }
const free = () => query('UPDATE users SET login_sid = NULL WHERE id = $1', [id])
const dash = (agent, pin = PIN) => agent.post('/api/auth/pin-login').send({ pin })
const till = (agent, pin = PIN) => agent.post('/api/till/login').send({ pin })

beforeAll(async () => {
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  await cleanup()
  id = (await createUser({ name: 'One Login', role: 'staff', branchId: blv, pin: PIN, dailyWage: 10 })).id
  admin = request.agent(app)
  expect((await admin.post('/api/auth/login').send({ email: 'admin@demo.com', password: PW })).status).toBe(200)
})
afterAll(async () => { await cleanup(); await query('UPDATE branches SET ip = NULL'); await pool.end().catch(() => {}) })

test('a staff PIN must be exactly 6 digits', async () => {
  for (const pin of ['1234', '12345', '1234567', '12345a']) {
    const r = await admin.post('/api/users').send({ name: 'Bad Pin', pin, role: 'staff' })
    expect(r.status, `PIN ${pin}`).toBe(400)
    expect(r.body.message).toMatch(/6 digits/)
  }
  // The database refuses it too, so nothing written around the API can leave a short PIN behind.
  await expect(query("UPDATE users SET pin = '1234' WHERE id = $1", [id])).rejects.toThrow()
})

test('signing in works with the 6-digit PIN, and a second device is refused while it is live', async () => {
  await atBranch(); await free()
  const phone = request.agent(app)
  expect((await dash(phone)).status).toBe(200)

  const pc = request.agent(app)
  const again = await dash(pc)
  expect(again.status, 'second device').toBe(409)
  expect(again.body.message).toMatch(/already signed in/i)
  expect((await pc.get('/api/auth/me')).status, 'the refused device holds no cookie').toBe(401)
  expect((await till(request.agent(app))).status, 'the till is another device too').toBe(409)
  expect((await phone.get('/api/auth/me')).status, 'the first device is unaffected').toBe(200)
})

test('the same browser may sign in again, and the till and dashboard there are one login', async () => {
  await atBranch(); await free()
  const desk = request.agent(app)
  expect((await dash(desk)).status).toBe(200)
  expect((await dash(desk)).status, 'same browser, dashboard again').toBe(200)
  expect((await till(desk)).status, 'same browser, now the till').toBe(200)
  expect((await desk.get('/api/till/me')).status).toBe(200)
  expect((await desk.get('/api/auth/me')).status).toBe(200)
  // Logging out of the till leaves the dashboard login (same browser) alone.
  expect((await desk.post('/api/till/logout')).status).toBe(200)
  expect((await desk.get('/api/auth/me')).status, 'dashboard still signed in').toBe(200)
})

test('logging out frees the sign-in everywhere, and the other device can then sign in', async () => {
  await atBranch(); await free()
  const a = request.agent(app)
  await dash(a)
  expect((await dash(request.agent(app))).status).toBe(409)
  expect((await a.post('/api/auth/logout')).status).toBe(200)
  expect((await query('SELECT login_sid FROM users WHERE id = $1', [id])).rows[0].login_sid).toBeNull()
  expect((await dash(request.agent(app))).status, 'free again').toBe(200)
})

test('logging out of the till alone frees the sign-in when nothing else here holds it', async () => {
  await atBranch(); await free()
  const t = request.agent(app)
  expect((await till(t)).status).toBe(200)
  expect((await dash(request.agent(app))).status).toBe(409)
  await t.post('/api/till/logout')
  expect((await dash(request.agent(app))).status).toBe(200)
})

test('an admin can see who is signed in and from where, and sign them out', async () => {
  await atBranch(); await free()
  const a = request.agent(app)
  await dash(a)
  const row = (await admin.get('/api/users?role=staff&all=1&limit=100')).body.find((u) => u.id === id)
  expect(row).toMatchObject({ signedIn: true, lastIp: '127.0.0.1', branchName: 'Belvedere' })
  expect(row, 'the sign-in id itself never leaves the server').not.toHaveProperty('login_sid')

  expect((await admin.post(`/api/users/${id}/sign-out`)).status).toBe(200)
  expect((await a.get('/api/auth/me')).status, 'their old device is signed out').toBe(401)
  const after = (await admin.get('/api/users?role=staff&all=1&limit=100')).body.find((u) => u.id === id)
  expect(after.signedIn).toBe(false)
  expect((await dash(request.agent(app))).status, 'and they can sign in again').toBe(200)
})

test('only an admin can sign someone out, and only staff have a sign-in to end', async () => {
  await atBranch(); await free()
  const staff = request.agent(app)
  await dash(staff)
  expect((await staff.post(`/api/users/${id}/sign-out`)).status, 'staff cannot').toBe(403)
  expect((await request(app).post(`/api/users/${id}/sign-out`)).status, 'nobody signed in cannot').toBe(401)
  const cust = (await query("SELECT id FROM users WHERE email = 'customer@demo.com'")).rows[0].id
  expect((await admin.post(`/api/users/${cust}/sign-out`)).status, 'a customer has none').toBe(400)
})

test('changing a PIN or switching someone off frees their sign-in, and the old PIN stops working', async () => {
  await atBranch(); await free()
  const a = request.agent(app)
  await dash(a)
  expect((await admin.put(`/api/users/${id}`).send({ pin: NEW_PIN })).status).toBe(200)
  expect((await a.get('/api/auth/me')).status, 'old cookie is dead').toBe(401)
  expect((await dash(request.agent(app), PIN)).status, 'old PIN').toBe(401)
  const b = request.agent(app)
  expect((await dash(b, NEW_PIN)).status, 'new PIN works at once').toBe(200)
  expect((await admin.put(`/api/users/${id}`).send({ active: false })).status).toBe(200)
  expect((await b.get('/api/auth/me')).status, 'switched off').toBe(401)
  // Put the account back as the other tests expect it.
  expect((await admin.put(`/api/users/${id}`).send({ active: true, pin: PIN })).status).toBe(200)
})

test('a wrong IP is refused without taking the sign-in', async () => {
  await free()
  await query('UPDATE branches SET ip = NULL')
  expect((await dash(request.agent(app))).status).toBe(403)
  expect((await query('SELECT login_sid FROM users WHERE id = $1', [id])).rows[0].login_sid, 'nothing was claimed').toBeNull()
})

test('customers and admins are not limited to one sign-in', async () => {
  const one = request.agent(app)
  const two = request.agent(app)
  expect((await one.post('/api/auth/login').send({ email: 'customer@demo.com', password: PW })).status).toBe(200)
  expect((await two.post('/api/auth/login').send({ email: 'customer@demo.com', password: PW })).status).toBe(200)
  expect((await one.get('/api/auth/me')).status).toBe(200)
  expect((await two.get('/api/auth/me')).status).toBe(200)
})
