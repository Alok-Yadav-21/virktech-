import { test, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from './app.js'
import pool, { query } from './db.js'

// Admin can add staff roles; a role is only a label, so any listed one can be given to a staff member.
const PW = 'Password123!'
const PIN = '660011'
const as = {}
let blv

const cleanup = async () => {
  await query('DELETE FROM users WHERE pin = $1', [PIN])
  await query("DELETE FROM staff_roles WHERE name IN ('Cleaner', 'Trainee Tech')")
}

beforeAll(async () => {
  await cleanup()
  blv = (await query("SELECT id FROM branches WHERE area = 'Belvedere'")).rows[0].id
  for (const [k, email] of [['admin', 'admin@demo.com'], ['customer', 'customer@demo.com']]) {
    as[k] = request.agent(app)
    expect((await as[k].post('/api/auth/login').send({ email, password: PW })).status).toBe(200)
  }
})
afterAll(async () => { await cleanup(); await pool.end() })

test('the four original roles are there, and only an admin can read or add roles', async () => {
  const list = (await as.admin.get('/api/staff-roles')).body
  expect(list).toEqual(expect.arrayContaining(['Shopkeeper', 'Manager', 'Biller', 'Repairer']))
  expect((await request(app).get('/api/staff-roles')).status, 'signed out').toBe(401)
  expect((await as.customer.get('/api/staff-roles')).status, 'customer').toBe(403)
  expect((await as.customer.post('/api/staff-roles').send({ name: 'Cleaner' })).status).toBe(403)
})

test('admin adds a new role, which can then be given to staff', async () => {
  const added = await as.admin.post('/api/staff-roles').send({ name: '  Cleaner ' })
  expect(added.status).toBe(201)
  expect(added.body.name, 'trimmed').toBe('Cleaner')
  expect(added.body.roles).toContain('Cleaner')

  const made = await as.admin.post('/api/users').send({ name: 'Role Holder', pin: PIN, role: 'staff', branchId: blv, staffRole: 'Cleaner' })
  expect(made.status).toBe(201)
  expect(made.body.staffRole).toBe('Cleaner')
  expect((await as.admin.put(`/api/users/${made.body.id}`).send({ staffRole: 'manager' })).body.staffRole, 'matched ignoring case, stored as listed').toBe('Manager')
  expect((await as.admin.put(`/api/users/${made.body.id}`).send({ staffRole: '' })).body.staffRole, 'can be cleared').toBeNull()
})

test('a role cannot be added twice, ignoring case, or be empty or too long; an unlisted role cannot be given', async () => {
  expect((await as.admin.post('/api/staff-roles').send({ name: 'cleaner' })).status, 'duplicate ignoring case').toBe(409)
  expect((await as.admin.post('/api/staff-roles').send({ name: 'BILLER' })).status, 'an original one').toBe(409)
  expect((await as.admin.post('/api/staff-roles').send({ name: '   ' })).status).toBe(400)
  expect((await as.admin.post('/api/staff-roles').send({})).status).toBe(400)
  expect((await as.admin.post('/api/staff-roles').send({ name: 'x'.repeat(41) })).status).toBe(400)
  const id = (await query('SELECT id FROM users WHERE pin = $1', [PIN])).rows[0].id
  const bad = await as.admin.put(`/api/users/${id}`).send({ staffRole: 'Wizard' })
  expect(bad.status).toBe(400)
  expect(bad.body.message).toMatch(/add it first/i)
})

test('extra spaces inside a role name are collapsed', async () => {
  const r = await as.admin.post('/api/staff-roles').send({ name: 'Trainee    Tech' })
  expect(r.status).toBe(201)
  expect(r.body.name).toBe('Trainee Tech')
})
