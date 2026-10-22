import { test, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import { protect, requireRole } from './middleware/auth.js'
import { errorHandler } from './middleware/error.js'
import app from './app.js'

// Tiny app so the guards are tested without a database.
const guarded = express()
guarded.use(cookieParser())
guarded.get('/admin', protect, requireRole('admin'), (req, res) => res.json({ ok: true }))
guarded.get('/role', (req, res, next) => { req.user = { role: req.query.r }; next() }, requireRole('admin', 'staff'), (req, res) => res.json({ ok: true }))
guarded.use(errorHandler)

test('health route and unknown api route', async () => {
  expect((await request(app).get('/api/health')).body).toEqual({ ok: true })
  expect((await request(app).get('/api/nope')).status).toBe(404)
})

test('no cookie -> 401', async () => {
  expect((await request(guarded).get('/admin')).status).toBe(401)
  expect((await request(app).get('/api/auth/me')).status).toBe(401)
})

test('garbage token -> 401', async () => {
  process.env.JWT_SECRET = 'test'
  const r = await request(guarded).get('/admin').set('Cookie', 'token=nope')
  expect(r.status).toBe(401)
})

test('requireRole allows listed roles only', async () => {
  expect((await request(guarded).get('/role?r=customer')).status).toBe(403)
  expect((await request(guarded).get('/role?r=staff')).status).toBe(200)
})

test('register rejects bad input before touching the DB', async () => {
  const r = await request(app).post('/api/auth/register').send({ name: 'x', email: 'bad', password: 'short' })
  expect(r.status).toBe(400)
  expect(r.body.message).toBeTruthy()
})
