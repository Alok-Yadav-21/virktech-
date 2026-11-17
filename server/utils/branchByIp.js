import net from 'node:net'
import { query } from '../db.js'
import { fail } from './validate.js'

// One spelling per address: IPv4-mapped IPv6 (::ffff:1.2.3.4) and the IPv6 loopback both become plain IPv4.
export const cleanIp = (ip) => {
  const s = String(ip ?? '').trim().replace(/^::ffff:/i, '')
  return s === '::1' ? '127.0.0.1' : s
}

// Admin typing in the branch form: blank clears it, anything else must be a real IP.
export const checkIp = (v) => {
  const ip = cleanIp(v)
  if (!ip) return null
  if (!net.isIP(ip)) throw fail(400, 'That is not a valid IP address')
  return ip
}

// Staff sign-in: the branch whose registered IP is the caller's. req.ip comes from the connection (or from
// X-Forwarded-For only when TRUST_PROXY is set), never from a field the browser sends.
export async function signInAtBranch(req, user) {
  const ip = cleanIp(req.ip)
  const { rows } = await query('SELECT id FROM branches WHERE ip = $1 AND active', [ip])
  if (!rows[0]) throw fail(403, 'This computer is not registered to a branch. Ask the admin.')
  await query('UPDATE users SET branch_id = $1, last_ip = $2, last_login_at = now() WHERE id = $3', [rows[0].id, ip, user.id])
  return { ...user, branch_id: rows[0].id }
}
