import { test, expect, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import pool, { query } from './db.js'
import { assertConfig } from './config.js'

afterAll(async () => {
  await query("DELETE FROM users WHERE email LIKE 'sec-%@test.local' OR email LIKE '%casing%@test.local'")
  await pool.end()
})

test('security headers are on and the framework banner is off', async () => {
  const r = await request(app).get('/api/health')
  expect(r.headers['x-content-type-options']).toBe('nosniff')
  expect(r.headers['content-security-policy']).toContain("default-src 'self'")
  expect(r.headers['x-powered-by']).toBeUndefined()
})

test('bad bodies get clean errors, not stack traces', async () => {
  const big = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(200_000) })
  expect(big.status).toBe(413)
  expect(big.body.message).toBeTruthy()
  const broken = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":')
  expect(broken.status).toBe(400)
  expect(JSON.stringify(broken.body)).not.toMatch(/at |node_modules/)
})

test('health/db proves the database answers', async () => {
  expect((await request(app).get('/api/health/db')).body).toEqual({ ok: true })
})

test('emails are stored lowercase, Gmail dots are kept, and login is case-insensitive', async () => {
  const email = 'Sec-Casing.Dots+tag@Test.Local'
  const reg = await request(app).post('/api/auth/register').send({ name: 'Casing', email, password: 'Password123!' })
  expect(reg.status).toBe(201)
  expect(reg.body.email).toBe('sec-casing.dots+tag@test.local')
  expect((await request(app).post('/api/auth/login').send({ email: 'SEC-CASING.DOTS+TAG@TEST.LOCAL', password: 'Password123!' })).status).toBe(200)
  expect((await request(app).post('/api/auth/register').send({ name: 'Dup', email: email.toLowerCase(), password: 'Password123!' })).status).toBe(409)
})

test('the session cookie is httpOnly and SameSite=Lax', async () => {
  const r = await request(app).post('/api/auth/login').send({ email: 'customer@demo.com', password: 'Password123!' })
  const cookie = r.headers['set-cookie'].join(';')
  expect(cookie).toMatch(/HttpOnly/i)
  expect(cookie).toMatch(/SameSite=Lax/i)
})

test('wrong password and unknown email give the same answer', async () => {
  const a = await request(app).post('/api/auth/login').send({ email: 'customer@demo.com', password: 'wrong-password' })
  const b = await request(app).post('/api/auth/login').send({ email: 'nobody@test.local', password: 'wrong-password' })
  expect([a.status, b.status]).toEqual([401, 401])
  expect(a.body).toEqual(b.body)
})

test('a password change ends other sessions but keeps the one that changed it', async () => {
  const email = 'sec-session@test.local'
  const first = request.agent(app)
  await first.post('/api/auth/register').send({ name: 'Session', email, password: 'Password123!' })
  const second = request.agent(app)
  await second.post('/api/auth/login').send({ email, password: 'Password123!' })

  const change = await first.patch('/api/auth/me').send({ currentPassword: 'Password123!', newPassword: 'NewPassword456!' })
  expect(change.status).toBe(200)
  expect((await first.get('/api/auth/me')).status, 'the session that changed it stays signed in').toBe(200)
  expect((await second.get('/api/auth/me')).status, 'the other session is ended').toBe(401)
  expect((await request(app).post('/api/auth/login').send({ email, password: 'Password123!' })).status).toBe(401)
  expect((await request(app).post('/api/auth/login').send({ email, password: 'NewPassword456!' })).status).toBe(200)
})

test('production refuses a weak or missing secret', () => {
  const saved = { ...process.env }
  try {
    process.env.NODE_ENV = 'production'
    process.env.DATABASE_URL = 'postgres://x/y'
    process.env.JWT_SECRET = 'change-me-to-a-long-random-string'
    expect(() => assertConfig()).toThrow(/JWT_SECRET/)
    process.env.JWT_SECRET = 'short'
    expect(() => assertConfig()).toThrow(/32 characters/)
    process.env.JWT_SECRET = 'q9Zk2mXv8LpR4tYw7BnC1dHf6GsJ3aUe5oIx0VzMkPqNrTb'
    process.env.TRUST_PROXY = '1'
    expect(() => assertConfig()).not.toThrow()
    delete process.env.JWT_SECRET
    expect(() => assertConfig()).toThrow(/JWT_SECRET is not set/)
  } finally {
    process.env = saved
  }
})

// Last on purpose: the limiter counts per address and is switched off for the other tests.
test('repeated failed logins are throttled with a JSON message', async () => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  try {
    let last
    for (let i = 0; i < 12; i++) last = await request(app).post('/api/auth/login').send({ email: 'customer@demo.com', password: `wrong-${i}` })
    expect(last.status).toBe(429)
    expect(last.body.message).toMatch(/Too many/)
  } finally {
    process.env.NODE_ENV = before
  }
})
