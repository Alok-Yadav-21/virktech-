import { query } from '../db.js'
import { scopeClause } from './scope.js'
import { allowedMoves, customerStage, quoteSent, repairAmountDue } from './rules.js'
import { likeOf } from './paging.js'

const SELECT = `
  SELECT r.*, cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
         b.name AS branch_name, b.area AS branch_area, te.name AS technician_name, count(*) OVER() AS total_count
  FROM repairs r
  JOIN users cu ON cu.id = r.customer_id
  JOIN branches b ON b.id = r.branch_id
  LEFT JOIN users te ON te.id = r.technician_id`

// Scoped read: the only way a route gets repairs, so no route can forget the scope filter.
// q searches reference, customer name/email and device model.
export async function findRepairs(user, { ref, status, q, limit = 500, offset = 0 } = {}) {
  const scope = scopeClause(user, { customer: 'r.customer_id', branch: 'r.branch_id' })
  const where = [scope.sql]
  const params = [...scope.params]
  if (ref) { params.push(ref); where.push(`r.reference = $${params.length}`) }
  if (status) { params.push(status); where.push(`r.status = $${params.length}`) }
  if (q) {
    params.push(likeOf(q))
    const n = `$${params.length}`
    where.push(`(r.reference ILIKE ${n} OR cu.name ILIKE ${n} OR cu.email ILIKE ${n} OR r.device_model ILIKE ${n})`)
  }
  params.push(limit, offset)
  const { rows } = await query(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY r.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
  return rows
}

// Shape sent to the client. Customers never get an unsent quote, internal notes, parts or technician.
export function toRepair(r, role) {
  const customer = role === 'customer'
  const sent = quoteSent({ status: r.status, history: r.history })
  const repair = {
    reference: r.reference,
    status: r.status,
    device: { category: r.device_category, brand: r.device_brand, model: r.device_model },
    problem: r.problem,
    fulfilment: r.fulfilment,
    branch: { id: r.branch_id, name: r.branch_name, area: r.branch_area },
    history: r.history,
    cancelReason: r.cancel_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    stage: customerStage({ status: r.status, history: r.history }),
    allowed: allowedMoves(r.status, customer ? 'customer' : 'staff'),
    loyaltyDiscount: r.loyalty_discount,
    quote: !customer || sent ? r.quote : null,
    paymentStatus: r.payment_status,
    paidAt: r.paid_at,
    amountDue: !customer || sent ? (r.quote == null ? null : repairAmountDue({ quote: r.quote, loyaltyDiscount: r.loyalty_discount })) : null,
  }
  if (customer) return { ...repair, notes: r.notes.filter((n) => n.visibleToCustomer) }
  return {
    ...repair,
    customer: { id: r.customer_id, name: r.customer_name, email: r.customer_email, phone: r.customer_phone },
    technician: r.technician_id ? { id: r.technician_id, name: r.technician_name } : null,
    notes: r.notes,
    parts: r.parts,
  }
}
