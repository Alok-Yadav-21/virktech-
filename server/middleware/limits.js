import rateLimit from 'express-rate-limit'

// Vitest sets NODE_ENV=test; the access tests log in many times from one address.
const skip = () => process.env.NODE_ENV === 'test'
const make = (windowMs, limit, message, extra = {}) =>
  rateLimit({ windowMs, limit, skip, standardHeaders: 'draft-7', legacyHeaders: false, message: { message }, ...extra })

export const apiLimiter = make(60_000, 600, 'Too many requests. Please slow down.')
// Only failed attempts count, so a shop full of staff logging in on one IP is not locked out.
export const loginLimiter = make(15 * 60_000, 10, 'Too many failed logins. Try again in 15 minutes.', { skipSuccessfulRequests: true })
export const registerLimiter = make(60 * 60_000, 10, 'Too many sign-ups from this address. Try again later.')
// A PIN is only 4 digits, so wrong guesses are limited hard (per address) on top of the login limit.
export const pinLimiter = make(15 * 60_000, 10, 'Too many wrong PINs. Try again in 15 minutes.', { skipSuccessfulRequests: true })
