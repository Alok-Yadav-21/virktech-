import { query } from '../db.js'
import { scopeClause } from './scope.js'
import { orderMoves, orderCanCancel } from './rules.js'
import { likeOf } from './paging.js'

const SELECT = `
  SELECT o.*, cu.name AS customer_name, cu.email AS customer_email, cu.phone AS customer_phone,
         b.name AS branch_name, b.area AS branch_area, count(*) OVER() AS total_count
  FROM orders o
  JOIN users cu ON cu.id = o.customer_id
  JOIN branches b ON b.id = o.branch_id`

// Scoped read: the only way a route gets orders, so no route can forget the scope filter.
// q searches reference and customer name/email.
export async function findOrders(user, { ref, status, q, limit = 500, offset = 0 } = {}) {
  const scope = scopeClause(user, { customer: 'o.customer_id', branch: 'o.branch_id' })
  const where = [scope.sql]
  const params = [...scope.params]
  if (ref) { params.push(ref); where.push(`o.reference = $${params.length}`) }
  if (status) { params.push(status); where.push(`o.status = $${params.length}`) }
  if (q) {
    params.push(likeOf(q))
    const n = `$${params.length}`
    where.push(`(o.reference ILIKE ${n} OR cu.name ILIKE ${n} OR cu.email ILIKE ${n})`)
  }
  params.push(limit, offset)
  const { rows } = await query(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY o.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
  return rows
}

export function toOrder(o, role) {
  const order = {
    reference: o.reference,
    status: o.status,
    paymentStatus: o.payment_status,
    paymentMethod: o.payment_method,
    deliveryMethod: o.delivery_method,
    address: o.address,
    items: o.items,
    total: o.total,
    loyaltyDiscount: o.loyalty_discount,
    branch: { id: o.branch_id, name: o.branch_name, area: o.branch_area },
    history: o.history,
    createdAt: o.created_at,
    canCancel: orderCanCancel(o.status),
    // Customers cannot move an order along; only cancel it.
    allowed: role === 'customer' ? [] : orderMoves({ status: o.status, deliveryMethod: o.delivery_method, paymentStatus: o.payment_status }),
    canPay: role !== 'customer' && o.payment_status === 'unpaid' && o.status !== 'cancelled',
  }
  if (role === 'customer') return order
  return { ...order, customer: { id: o.customer_id, name: o.customer_name, email: o.customer_email, phone: o.customer_phone } }
}
