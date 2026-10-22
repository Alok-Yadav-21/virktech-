import { query } from '../db.js'
import { scopeClause } from './scope.js'
import { tradeInMoves, tradeInOfferSent, tradeInEditable } from './rules.js'
import { likeOf } from './paging.js'

const SELECT = `
  SELECT t.*, cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
         b.name AS branch_name, b.area AS branch_area, count(*) OVER() AS total_count
  FROM trade_ins t
  JOIN users cu ON cu.id = t.customer_id
  JOIN branches b ON b.id = t.branch_id`

// Scoped read: the only way a route gets trade-ins, so no route can forget the scope filter.
// q searches reference, customer name/email and device model.
export async function findTradeIns(user, { ref, status, q, limit = 500, offset = 0 } = {}) {
  const scope = scopeClause(user, { customer: 't.customer_id', branch: 't.branch_id' })
  const where = [scope.sql]
  const params = [...scope.params]
  if (ref) { params.push(ref); where.push(`t.reference = $${params.length}`) }
  if (status) { params.push(status); where.push(`t.status = $${params.length}`) }
  if (q) {
    params.push(likeOf(q))
    const n = `$${params.length}`
    where.push(`(t.reference ILIKE ${n} OR cu.name ILIKE ${n} OR cu.email ILIKE ${n} OR t.device_model ILIKE ${n})`)
  }
  params.push(limit, offset)
  const { rows } = await query(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
  return rows
}

// Shared shape for rules: the DB row in the camelCase the rules expect.
export const forRules = (t) => ({ status: t.status, history: t.history, finalOffer: t.final_offer })

export function toTradeIn(t, role) {
  const customer = role === 'customer'
  const trade = {
    reference: t.reference,
    status: t.status,
    device: { category: t.device_category, brand: t.device_brand, model: t.device_model },
    condition: t.condition,
    details: t.details,
    photos: t.photos,
    branch: { id: t.branch_id, name: t.branch_name, area: t.branch_area },
    indicativeValue: t.indicative_value,
    // Unsent offers never reach the customer.
    finalOffer: !customer || tradeInOfferSent(forRules(t)) ? t.final_offer : null,
    history: t.history,
    createdAt: t.created_at,
    allowed: tradeInMoves(t.status, customer ? 'customer' : 'staff'),
    canEditValues: !customer && tradeInEditable(forRules(t)),
  }
  if (customer) return trade
  return { ...trade, customer: { id: t.customer_id, name: t.customer_name, email: t.customer_email, phone: t.customer_phone } }
}
