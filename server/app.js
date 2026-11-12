import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { query } from './db.js'
import { apiLimiter } from './middleware/limits.js'
import { protect, requireRole } from './middleware/auth.js'
import { requestLogger } from './middleware/logger.js'
import { notFound, errorHandler } from './middleware/error.js'
import authRoutes from './routes/auth.js'
import repairRoutes from './routes/repairs.js'
import orderRoutes from './routes/orders.js'
import tradeinRoutes from './routes/tradeins.js'
import loyaltyRoutes from './routes/loyalty.js'
import dashboardRoutes from './routes/dashboard.js'
import stockRoutes from './routes/stock.js'
import deliveryRoutes from './routes/deliveries.js'
import marginRoutes from './routes/margins.js'
import reportRoutes from './routes/reports.js'
import vapeRoutes from './routes/vapes/index.js'
import userRoutes from './routes/users.js'
import shiftRoutes from './routes/shifts.js'
import tillRoutes from './routes/till.js'
import branchRoutes from './routes/branchStock.js'
import { products, categories, services, branches } from './routes/catalogue.js'

const app = express()
if (config.trustProxy) app.set('trust proxy', config.trustProxy)

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // react-bootstrap and Leaflet set inline styles
      imgSrc: ["'self'", 'data:', 'https:'],   // product photos (any https URL an admin enters) and map tiles
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
}))
app.use(requestLogger)
if (config.clientOrigins.length) {
  app.use(cors({ origin: config.clientOrigins, credentials: true, exposedHeaders: ['X-Total-Count'] }))
}
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())

// Liveness needs no database; /health/db proves the database answers (use it for host health checks).
app.get('/api/health', (req, res) => res.json({ ok: true }))
app.get('/api/health/db', async (req, res) => {
  try { await query('SELECT 1'); res.json({ ok: true }) } catch { res.status(503).json({ ok: false }) }
})

app.use('/api', apiLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/products', products)
app.use('/api/categories', categories)
app.use('/api/services', services)
app.use('/api/branches', branches)
app.use('/api/stock', stockRoutes)
app.use('/api/deliveries', deliveryRoutes)
app.use('/api/margins', marginRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/vapes', vapeRoutes)
app.use('/api/repairs', repairRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/tradeins', tradeinRoutes)
app.use('/api/loyalty', loyaltyRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users', userRoutes)
app.use('/api/shifts', shiftRoutes)
app.use('/api/till', tillRoutes)
app.use('/api/branch', protect, requireRole('staff'), branchRoutes)
app.use('/api', notFound)

// One deploy: when client/dist exists (npm run build in client/) this server also serves the website.
const dist = fileURLToPath(new URL('../client/dist', import.meta.url))
if (config.serveClient && existsSync(join(dist, 'index.html'))) {
  app.use(express.static(dist, {
    index: false,
    // Built assets have hashed names, so they can be cached for a year; everything else is re-checked.
    setHeaders: (res, path) => res.setHeader('Cache-Control', path.includes(`${join(dist, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'),
  }))
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(join(dist, 'index.html'))
  })
}

app.use(errorHandler)

export default app
