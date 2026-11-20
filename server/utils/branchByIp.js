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

// Staff sign-in, from any device. Nothing is compared with a saved IP: the person says which branch they are working at
// (without one the answer is 422, which the sign-in screen turns into a branch picker and resubmits), and the sign-in
// records that branch and the IP it came from (see clientIp) for the admin to read. The branch is always the one picked
// at this sign-in; there is no home branch and no IP-to-branch matching.
export async function signInAtBranch(req, user, chosen) {
  if (chosen == null || chosen === '') throw fail(422, 'Choose the branch you are working at')
  const branchId = Number(chosen)
  if (!Number.isInteger(branchId) || !(await query('SELECT 1 FROM branches WHERE id = $1 AND active', [branchId])).rowCount) {
    throw fail(400, 'Choose one of the listed branches')
  }
  const ip = clientIp(req)
  await query('UPDATE users SET branch_id = $1, last_ip = $2, last_login_at = now() WHERE id = $3', [branchId, ip, user.id])
  return { ...user, branch_id: branchId }
}
