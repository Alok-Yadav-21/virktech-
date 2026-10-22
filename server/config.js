// One place for environment settings, with checks that stop the server from starting half-configured.
const env = process.env
const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [])

export const config = {
  isProd: env.NODE_ENV === 'production',
  port: Number(env.PORT) || 5000,
  // Origins allowed to call the API from a browser. Leave empty when the API serves the client itself.
  clientOrigins: csv(env.CLIENT_URL),
  // Set to 1 behind one reverse proxy (Render, Railway, nginx...) so rate limits see real client IPs.
  trustProxy: env.TRUST_PROXY ? (Number.isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY)) : false,
  serveClient: env.SERVE_CLIENT !== 'false',
}

export function assertConfig() {
  const problems = []
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is not set')
  if (!env.JWT_SECRET) problems.push('JWT_SECRET is not set')
  if (env.NODE_ENV === 'production') {
    if (env.JWT_SECRET && (env.JWT_SECRET.length < 32 || /change-?me|secret|password/i.test(env.JWT_SECRET))) {
      problems.push('JWT_SECRET must be a random string of at least 32 characters in production')
    }
    if (!env.TRUST_PROXY) console.warn('Warning: TRUST_PROXY is not set. Behind a reverse proxy, every visitor will share one rate-limit bucket.')
  }
  if (problems.length) throw new Error(`Configuration problem:\n - ${problems.join('\n - ')}`)
}
