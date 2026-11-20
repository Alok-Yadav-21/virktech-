import net from 'node:net'
import { query } from '../db.js'
import { fail } from './validate.js'

// One spelling per address: IPv4-mapped IPv6 (::ffff:1.2.3.4) and the IPv6 loopback both become plain IPv4.
export const cleanIp = (ip) => {
  const s = String(ip ?? '').trim().replace(/^::ffff:/i, '')
  return s === '::1' ? '127.0.0.1' : s
}

// The visitor's address. Behind Vercel the connection comes from Vercel's own proxy, so req.ip is that proxy
// (127.0.0.1 inside the function) and every visitor looks identical: no shop could ever match, and saving the
// shown address would let any PIN holder in from anywhere. Vercel passes the real address in headers its edge
// sets itself and a browser cannot forge, so those are read first, and only when running on Vercel. Anywhere
// else (local, a normal server) the headers are ignored and req.ip stands, so nobody can spoof a branch's IP.
export const clientIp = (req) => {
  if (process.env.VERCEL) {
    for (const h of ['x-vercel-forwarded-for', 'x-real-ip']) {
      const v = String(req.headers?.[h] ?? '').split(',')[0].trim()
      if (v) return cleanIp(v)
    }
  }
  return cleanIp(req.ip)
}

// Admin typing in the branch form: blank clears it, anything else must be a real IP.
export const checkIp = (v) => {
  const ip = cleanIp(v)
  if (!ip) return null
  if (!net.isIP(ip)) throw fail(400, 'That is not a valid IP address')
  return ip
}

// Staff sign-in: the branch whose registered IP is the caller's (see clientIp for where that comes from).
export async function signInAtBranch(req, user) {
  const ip = clientIp(req)
  const { rows } = await query('SELECT id FROM branches WHERE ip = $1 AND active', [ip])
  if (!rows[0]) throw fail(403, 'This computer is not registered to a branch. Ask the admin.')
  await query('UPDATE users SET branch_id = $1, last_ip = $2, last_login_at = now() WHERE id = $3', [rows[0].id, ip, user.id])
  return { ...user, branch_id: rows[0].id }
}
