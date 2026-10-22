import { pointsEarned, pointsForDiscount } from './rules.js'
import { fail } from './validate.js'

// The one place a balance changes. `db` is a pg client from tx() or the pool, so a points change
// can sit in the same transaction as the order/repair it belongs to. kind: earned | redeemed | adjusted.
export async function postLoyalty(db, userId, delta, kind, sourceRef, note) {
  // The WHERE keeps the balance from ever going negative, even under concurrent requests.
  const { rows } = await db.query(
    'UPDATE users SET loyalty_points = loyalty_points + $2 WHERE id = $1 AND loyalty_points + $2 >= 0 RETURNING loyalty_points', [userId, delta])
  if (!rows[0]) throw fail(400, 'Not enough points')
  await db.query('INSERT INTO loyalty_entries (user_id, delta, kind, source_ref, note) VALUES ($1,$2,$3,$4,$5)', [userId, delta, kind, sourceRef, note])
  return rows[0].loyalty_points
}

// Both award helpers flip points_awarded in the same statement that reads the row, so a repeated
// status change (or two racing requests) can never pay out twice.
export async function awardOrderPoints(db, reference) {
  const { rows: [o] } = await db.query(
    `UPDATE orders SET points_awarded = true
     WHERE reference = $1 AND points_awarded = false AND status IN ('delivered', 'collected')
     RETURNING customer_id, total`, [reference])
  const points = o ? pointsEarned(o.total) : 0 // total is already after any loyalty discount
  if (points) await postLoyalty(db, o.customer_id, points, 'earned', reference, 'Order completed')
  return points
}

export async function awardRepairPoints(db, reference) {
  const { rows: [r] } = await db.query(
    `UPDATE repairs SET points_awarded = true
     WHERE reference = $1 AND points_awarded = false AND status = 'Completed'
     RETURNING customer_id, quote, loyalty_discount`, [reference])
  const points = r ? pointsEarned(Number(r.quote || 0) - Number(r.loyalty_discount)) : 0
  if (points) await postLoyalty(db, r.customer_id, points, 'earned', reference, 'Repair completed')
  return points
}

// A refunded order undoes its points: the ones it earned come off, the ones spent at checkout come back.
// The balance is trimmed so it can never go below zero.
export async function reverseOrderPoints(db, order) {
  const earned = order.points_awarded ? pointsEarned(order.total) : 0
  const back = order.loyalty_discount > 0 ? pointsForDiscount(order.loyalty_discount) : 0
  const { rows: [u] } = await db.query('SELECT loyalty_points FROM users WHERE id = $1 FOR UPDATE', [order.customer_id])
  const delta = Math.max(-u.loyalty_points, back - earned)
  if (delta) await postLoyalty(db, order.customer_id, delta, 'adjusted', order.reference, 'Order refunded: points reversed')
  return delta
}
