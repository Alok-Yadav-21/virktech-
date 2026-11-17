import jwt from 'jsonwebtoken'
import { config } from '../config.js'

// The dashboard sign-in cookie. Used by the login routes and by the till's "open the dashboard" button, so the cookie is made in one place.
export const COOKIE = { httpOnly: true, sameSite: 'lax', secure: config.isProd, path: '/' }

export function setCookie(res, user) {
  // pv ties the token to the password it was issued under; changing the password invalidates it (no clock comparison).
  const token = jwt.sign({ id: user.id, pv: user.password_changed_at?.getTime() ?? 0 }, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.cookie('token', token, COOKIE)
}
