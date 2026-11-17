import bcrypt from 'bcryptjs'
import { query } from '../db.js'

// The shared account every till (walk-in) sale is booked to; created by migration 006, cannot log in.
export const WALK_IN_EMAIL = 'walk-in@till.local'

export const hashPassword = (plain) => bcrypt.hash(plain, 12)

// A real hash to compare against when the email is unknown, so "no such user" takes as long as "wrong password".
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

// The one place a user row gets written with a password.
// Staff have a PIN and a wage instead of an email and password.
export async function createUser({ name, email = null, password = null, phone = null, role = 'customer', branchId = null, pin = null, dailyWage = null, staffRole = null }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password, phone, role, branch_id, pin, daily_wage, staff_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [name, email, password && await hashPassword(password), phone, role, branchId, pin, dailyWage, staffRole],
  )
  return rows[0]
}

export const toPublic = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone,
  role: u.role, branch: u.branch_id, loyaltyPoints: u.loyalty_points,
})
