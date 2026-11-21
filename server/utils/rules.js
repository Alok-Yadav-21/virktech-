// Single source for business rules. Status vocabulary mirrored in client/src/constants.js.
export const ROLES = ['customer', 'staff', 'admin']

// ---- Repairs ---------------------------------------------------------------------------
export const REPAIR_STATUS = {
  BOOKED: 'Booking received',
  AWAITING: 'Awaiting device',
  RECEIVED: 'Device received',
  DIAGNOSTICS: 'Diagnostics',
  QUOTE: 'Quote awaiting approval',
  IN_PROGRESS: 'Repair in progress',
  PARTS: 'Parts ordered',
  QA: 'Quality check',
  READY: 'Ready for collection',
  DISPATCHED: 'Dispatched',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}
const S = REPAIR_STATUS
export const REPAIR_STATUSES = Object.values(S)
export const FULFILMENT = ['in_store', 'collection', 'mail_in']

// Forward moves only. Cancelled is handled separately because it needs a reason.
const FORWARD = {
  [S.BOOKED]: [S.AWAITING, S.RECEIVED], // walk-ins skip Awaiting device
  [S.AWAITING]: [S.RECEIVED],
  [S.RECEIVED]: [S.DIAGNOSTICS],
  [S.DIAGNOSTICS]: [S.QUOTE],
  [S.QUOTE]: [S.IN_PROGRESS], // customer approve only, see allowedMoves
  [S.IN_PROGRESS]: [S.PARTS, S.QA],
  [S.PARTS]: [S.IN_PROGRESS],
  [S.QA]: [S.READY],
  [S.READY]: [S.COMPLETED, S.DISPATCHED],
  [S.DISPATCHED]: [S.COMPLETED],
  [S.COMPLETED]: [],
  [S.CANCELLED]: [],
}
const isFinal = (status) => status === S.COMPLETED || status === S.CANCELLED

// Statuses `actor` ('customer' | 'staff', where staff includes admin) may move a repair to.
export function allowedMoves(status, actor) {
  if (actor === 'customer') {
    if (status === S.QUOTE) return [S.IN_PROGRESS, S.CANCELLED] // approve or decline
    if (status === S.BOOKED || status === S.AWAITING) return [S.CANCELLED]
    return []
  }
  // Approval belongs to the customer, so staff get no forward move out of the quote stage.
  const forward = status === S.QUOTE ? [] : FORWARD[status] || []
  return isFinal(status) ? [] : [...forward, S.CANCELLED]
}

// Returns an error message, or null when the change is allowed. One check for every route.
export function statusChangeError(repair, to, actor, reason) {
  if (!allowedMoves(repair.status, actor).includes(to)) {
    return `A repair cannot move from "${repair.status}" to "${to}"`
  }
  if (to === S.CANCELLED && !String(reason || '').trim()) return 'A reason is required to cancel'
  if (to === S.QUOTE && !(Number(repair.quote) > 0)) return 'Enter the quote amount before sending it to the customer'
  // Hand-over and payment happen together: a device cannot leave the shop unpaid.
  if (to === S.COMPLETED && repair.paymentStatus !== 'paid') return 'Mark the repair as paid before completing it'
  return null
}

// Payment is taken when the customer collects (or on delivery), so only once the repair is ready.
export function repairPayError(repair) {
  if (repair.paymentStatus !== 'unpaid') return 'This repair has already been paid'
  if (!(Number(repair.quote) > 0)) return 'This repair has no quote to pay'
  if (![S.READY, S.DISPATCHED].includes(repair.status)) return 'Take payment once the repair is ready for collection'
  return null
}

// What the customer owes: the quote less any loyalty discount, to the penny.
export const repairAmountDue = (repair) => Math.round((Number(repair.quote) - Number(repair.loyaltyDiscount || 0)) * 100) / 100

const reached = (repair, status) => repair.status === status || (repair.history || []).some((h) => h.status === status)

// A quote is only the customer's business once it has been sent.
export const quoteSent = (repair) => reached(repair, S.QUOTE)

// What the customer sees. Derived from the stored status, never stored.
export const CUSTOMER_STAGES = [
  { key: 'booked', covers: [S.BOOKED], label: 'Booking confirmed' },
  { key: 'awaiting_device', covers: [S.AWAITING], label: 'Waiting for your device', nextStep: 'Bring your device into the branch, or post it to us.' },
  { key: 'with_us', covers: [S.RECEIVED, S.DIAGNOSTICS], label: 'Device with us' },
  { key: 'approval', covers: [S.QUOTE], label: 'Your approval needed', nextStep: 'Review your quote and approve it so we can start work.' },
  { key: 'in_repair', covers: [S.IN_PROGRESS, S.PARTS, S.QA], label: 'Being repaired' },
  { key: 'ready', covers: [S.READY, S.DISPATCHED], label: 'Ready to collect', nextStep: 'Collect it from your branch and bring your reference number.' },
  { key: 'done', covers: [S.COMPLETED], label: 'Completed' },
]

export function customerStage(repair) {
  const index = CUSTOMER_STAGES.findIndex((s) => s.covers.includes(repair.status))
  if (index < 0) return { index: -1, key: 'cancelled', label: 'Cancelled', nextStep: null } // a stop, not a step
  const s = CUSTOMER_STAGES[index]
  const dispatched = s.key === 'ready' && reached(repair, S.DISPATCHED)
  return {
    index,
    key: s.key,
    label: dispatched ? 'On its way to you' : s.label,
    nextStep: dispatched ? null : s.nextStep ?? null,
  }
}

// ---- Orders ----------------------------------------------------------------------------
export const ORDER_STATUS = {
  PENDING: 'pending', PAID: 'paid', PROCESSING: 'processing', READY: 'ready', DISPATCHED: 'dispatched',
  DELIVERED: 'delivered', COLLECTED: 'collected', CANCELLED: 'cancelled', REFUNDED: 'refunded',
}
const O = ORDER_STATUS
export const DELIVERY_METHODS = ['collection', 'delivery']
export const PAYMENT_METHODS = ['cash', 'card_in_store']

// Next statuses staff can set. Cancel is separate (orderCanCancel) and paying is its own action.
// Collection orders go ready -> collected; delivery orders go dispatched -> delivered.
export function orderMoves(order) {
  switch (order.status) {
    case O.PENDING: case O.PAID: return [O.PROCESSING]
    case O.PROCESSING: return [order.deliveryMethod === 'delivery' ? O.DISPATCHED : O.READY]
    case O.READY: return [O.COLLECTED]
    case O.DISPATCHED: return [O.DELIVERED]
    case O.DELIVERED: case O.COLLECTED: return order.paymentStatus === 'paid' ? [O.REFUNDED] : []
    default: return []
  }
}

// Once it has left the shop (or is already over) it can no longer be cancelled.
export const orderCanCancel = (status) => ![O.DISPATCHED, O.DELIVERED, O.COLLECTED, O.CANCELLED, O.REFUNDED].includes(status)

// Prices are 2dp; summing in pence avoids 0.1 + 0.2 style drift.
export const orderTotal = (items) => items.reduce((sum, i) => sum + Math.round(i.price * 100) * i.qty, 0) / 100

// ---- Trade-ins -------------------------------------------------------------------------
export const TRADEIN_STATUS = {
  SUBMITTED: 'submitted', REVIEW: 'valuation_review', OFFER_SENT: 'offer_sent', ACCEPTED: 'offer_accepted',
  DECLINED: 'offer_declined', PAID: 'paid', COMPLETED: 'completed', CANCELLED: 'cancelled',
}
const T = TRADEIN_STATUS
export const TRADEIN_STATUSES = Object.values(T)
export const TRADEIN_CONDITIONS = ['Like new', 'Good', 'Fair', 'Poor']

// Each step is exactly the next one. Accepting or declining the offer belongs to the customer.
const TRADEIN_NEXT = { [T.SUBMITTED]: T.REVIEW, [T.REVIEW]: T.OFFER_SENT, [T.ACCEPTED]: T.PAID, [T.PAID]: T.COMPLETED }
const tradeInFinal = (s) => [T.COMPLETED, T.CANCELLED, T.DECLINED].includes(s)

// `actor` is 'customer' or 'staff' (staff includes admin).
export function tradeInMoves(status, actor) {
  if (actor === 'customer') {
    if (status === T.OFFER_SENT) return [T.ACCEPTED, T.DECLINED]
    return status === T.SUBMITTED ? [T.CANCELLED] : [] // withdraw before anyone has started valuing
  }
  if (tradeInFinal(status)) return []
  return [...(TRADEIN_NEXT[status] ? [TRADEIN_NEXT[status]] : []), T.CANCELLED]
}

export function tradeInChangeError(t, to, actor) {
  if (!tradeInMoves(t.status, actor).includes(to)) return `A trade-in cannot move from "${t.status}" to "${to}"`
  if (to === T.OFFER_SENT && !(Number(t.finalOffer) > 0)) return 'Enter the offer amount before sending it to the customer'
  return null
}

// The offer is only the customer's business once it has been sent.
export const tradeInOfferSent = (t) => t.status === T.OFFER_SENT || (t.history || []).some((h) => h.status === T.OFFER_SENT)
export const tradeInEditable = (t) => !tradeInFinal(t.status) && !tradeInOfferSent(t)

// ---- Loyalty ---------------------------------------------------------------------------
export const LOYALTY = { POINTS_PER_TEN_POUNDS: 5, STEP_POINTS: 10, STEP_VALUE: 2, MAX_SHARE: 0.2 }

// 5 points per full £10, but only when spend is strictly over £10 (£10 earns 0, £11 earns 5).
export function pointsEarned(spend) {
  const pence = Math.round(Number(spend) * 100)
  return pence > 1000 ? Math.floor(pence / 1000) * LOYALTY.POINTS_PER_TEN_POUNDS : 0
}

// Points used in steps of 10 (= £2 each), at most 20% of the bill. Over-asking is trimmed, not rejected.
export function redemption({ requested, balance, bill }) {
  const asked = Math.floor(Number(requested) / LOYALTY.STEP_POINTS)
  const owned = Math.floor(Number(balance) / LOYALTY.STEP_POINTS)
  // 20% of the bill in pence, divided by the pence value of one step.
  const capped = Math.floor((Math.round(Number(bill) * 100) * LOYALTY.MAX_SHARE) / (LOYALTY.STEP_VALUE * 100))
  const steps = Math.max(0, Math.min(asked || 0, owned || 0, capped || 0))
  return { points: steps * LOYALTY.STEP_POINTS, discount: steps * LOYALTY.STEP_VALUE }
}

// Points to hand back when a discount is undone (e.g. a cancelled order).
export const pointsForDiscount = (discount) => Math.round((discount / LOYALTY.STEP_VALUE) * LOYALTY.STEP_POINTS)

// ---- Reporting -------------------------------------------------------------------------
// "Open" = still needs someone to do something.
export const REPAIR_CLOSED = [REPAIR_STATUS.COMPLETED, REPAIR_STATUS.CANCELLED]
export const ORDER_CLOSED = [ORDER_STATUS.DELIVERED, ORDER_STATUS.COLLECTED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED]
export const TRADEIN_CLOSED = [TRADEIN_STATUS.COMPLETED, TRADEIN_STATUS.CANCELLED, TRADEIN_STATUS.DECLINED]

// Revenue = paid orders that were not cancelled or refunded. Never widen this to flatter a report.
// Pass a table alias when the query joins other tables.
export const revenueWhere = (alias = '') => {
  const p = alias ? `${alias}.` : ''
  return `${p}payment_status = 'paid' AND ${p}status NOT IN ('cancelled', 'refunded')`
}

// Repair takings are reported on their own line and are never added into order revenue.
// A cancelled paid repair becomes payment_status 'refunded', so 'paid' alone is the right test.
export const repairTakingsWhere = (alias = '') => `${alias ? `${alias}.` : ''}payment_status = 'paid'`

// ---- Deliveries and profit -------------------------------------------------------------
export const DELIVERY_LIMITS = { MAX_LINES: 100, MAX_QTY: 100000, MAX_UNIT_COST: 100000 }

// Money in pence so 0.1 + 0.2 style drift never reaches a report.
const pence = (n) => Math.round(Number(n) * 100)

// 100 pieces at £10 each = £1000.
export const lineCost = (qty, unitCost) => (qty * pence(unitCost)) / 100

// Average cost per piece is worked out in SQL (weighted by quantity, rounded to the penny); these turn it into profit.
// Profit on one piece sold at `price` that cost `cost`. Null when no delivery has recorded a cost yet.
export const unitProfit = (price, cost) => (cost == null ? null : (pence(price) - pence(cost)) / 100)

// Margin = profit as a share of the selling price, one decimal place (cost 10, price 20 -> 50).
export function marginPct(price, cost) {
  if (cost == null || !(pence(price) > 0)) return null
  return Math.round(((pence(price) - pence(cost)) / pence(price)) * 1000) / 10
}

// Stock change when a delivery is edited: new quantities minus old, per product. Zero changes are dropped.
export function stockDeltas(oldItems, newItems) {
  const delta = new Map()
  for (const i of oldItems) delta.set(i.productId, (delta.get(i.productId) || 0) - i.qty)
  for (const i of newItems) delta.set(i.productId, (delta.get(i.productId) || 0) + i.qty)
  return [...delta].filter(([, d]) => d !== 0).sort((a, b) => a[0] - b[0]) // fixed order avoids deadlocks
}

// ---- Shifts ----------------------------------------------------------------------------
// Whole minutes worked (rounded down). An open shift is measured up to `endedAt` = now.
export const shiftMinutes = (startedAt, endedAt = new Date()) =>
  Math.max(0, Math.floor((new Date(endedAt) - new Date(startedAt)) / 60000))

// Staff are paid per day worked. A day is a UK calendar day with at least one shift started in it, and it pays the
// rate stored on that day's first shift, once however many shifts or hours. Returns the ids of the shifts that earn the day.
// Each shift needs { id, userId, day: 'YYYY-MM-DD', startedAt }.
export function dayEarners(shifts) {
  const first = new Map()
  for (const s of shifts) {
    const key = `${s.userId}|${s.day}`
    if (!first.has(key) || new Date(s.startedAt) < new Date(first.get(key).startedAt)) first.set(key, s)
  }
  return new Set([...first.values()].map((s) => s.id))
}
