import bcrypt from 'bcryptjs'
import { query } from '../db.js'

export const hashPassword = (plain) => bcrypt.hash(plain, 12)

// A real hash to compare against when the email is unknown, so "no such user" takes as long as "wrong password".
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12)

// The one place a user row gets written with a password.
export async function createUser({ name, email, password, phone = null, role = 'customer', branchId = null }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password, phone, role, branch_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, email, await hashPassword(password), phone, role, branchId],
  )
  return rows[0]
}

export const toPublic = (u) => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone,
  role: u.role, branch: u.branch_id, loyaltyPoints: u.loyalty_points,
})
