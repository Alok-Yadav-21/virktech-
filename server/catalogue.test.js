import { test, expect } from 'vitest'
import request from 'supertest'
import app from './app.js'

// No cookie: every write and the admin view must be refused before any DB access.
test('catalogue writes and ?all=1 need a login', async () => {
  for (const base of ['products', 'categories', 'services', 'branches']) {
    expect((await request(app).post(`/api/${base}`).send({})).status).toBe(401)
    expect((await request(app).put(`/api/${base}/1`).send({})).status).toBe(401)
    expect((await request(app).delete(`/api/${base}/1`)).status).toBe(401)
    expect((await request(app).get(`/api/${base}?all=1`)).status).toBe(401)
  }
})

test('nearest needs a postcode', async () => {
  expect((await request(app).get('/api/branches/nearest')).status).toBe(400)
})

test('repairs and users routes need a login', async () => {
  expect((await request(app).get('/api/repairs')).status).toBe(401)
  expect((await request(app).post('/api/repairs').send({})).status).toBe(401)
  expect((await request(app).get('/api/repairs/SPR-4801')).status).toBe(401)
  expect((await request(app).patch('/api/repairs/SPR-4801/status').send({})).status).toBe(401)
  expect((await request(app).get('/api/users')).status).toBe(401)
})

test('orders and stock adjust need a login', async () => {
  expect((await request(app).get('/api/orders')).status).toBe(401)
  expect((await request(app).post('/api/orders').send({})).status).toBe(401)
  expect((await request(app).patch('/api/orders/VT-ORD-10001/pay')).status).toBe(401)
  expect((await request(app).post('/api/orders/VT-ORD-10001/cancel')).status).toBe(401)
  expect((await request(app).get('/api/stock')).status).toBe(401)
  expect((await request(app).patch('/api/stock/1').send({ stock: 5 })).status).toBe(401)
})

test('trade-in routes need a login', async () => {
  expect((await request(app).get('/api/tradeins')).status).toBe(401)
  expect((await request(app).post('/api/tradeins').send({})).status).toBe(401)
  expect((await request(app).patch('/api/tradeins/VT-TI-3001').send({})).status).toBe(401)
  expect((await request(app).post('/api/tradeins/VT-TI-3001/respond').send({})).status).toBe(401)
})

test('loyalty routes need a login', async () => {
  for (const [m, p] of [['get', '/me'], ['get', '/lookup'], ['post', '/redeem'], ['post', '/adjust']]) {
    expect((await request(app)[m](`/api/loyalty${p}`)).status).toBe(401)
  }
})
