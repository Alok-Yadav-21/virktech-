import { query } from '../db.js'
import { fail } from './validate.js'

// Start and end shifts. Only the till calls these; the rules live in one place.
// Times always come from the server clock.
export const SHIFT = 'id, user_id AS "userId", started_at AS "startedAt", ended_at AS "endedAt", daily_wage AS "dailyWage"'

export async function startShift(user) {
  try {
    const { rows } = await query(
      `INSERT INTO shifts (user_id, branch_id, daily_wage) VALUES ($1, $2, $3) RETURNING ${SHIFT}`,
      [user.id, user.branch_id, user.daily_wage])
    return rows[0]
  } catch (e) {
    if (e.code === '23505') throw fail(409, 'A shift is already running') // the one-open-shift index
    throw e
  }
}

export async function endShift(userId) {
  // GREATEST keeps a shift ended within a second of starting valid (ended_at > started_at) instead of a 500.
  const { rows } = await query(
    `UPDATE shifts SET ended_at = GREATEST(now(), started_at + interval '1 second')
     WHERE user_id = $1 AND ended_at IS NULL RETURNING ${SHIFT}`, [userId])
  if (!rows[0]) throw fail(409, 'No shift is running')
  return rows[0]
}
