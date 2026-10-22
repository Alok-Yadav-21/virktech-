// Business rules for the vape range. Money maths (lineCost, unitProfit, marginPct, stockDeltas, orderTotal,
// revenueWhere) is shared with the electronics side and imported from rules.js, never copied.
export const VAPE_STATUS = { PENDING: 'pending', READY: 'ready', COLLECTED: 'collected', CANCELLED: 'cancelled', REFUNDED: 'refunded' }
const V = VAPE_STATUS
export const VAPE_STATUSES = Object.values(V)
export const VAPE_PAYMENT_METHODS = ['cash', 'card_in_store']

// No disposables: they are banned for sale in the UK.
export const VAPE_KINDS = ['Pod kit', 'Refill pod', 'E-liquid', 'Coil', 'Accessory']
export const FLAVOUR_GROUPS = ['Fruit', 'Menthol & ice', 'Tobacco', 'Sweet & dessert', 'Drinks', 'Unflavoured']
export const MAX_NICOTINE_MG = 20 // mg/ml, the UK legal limit
export const VAPE_ORDER_LIMITS = { MAX_LINES: 30, MAX_QTY: 20 }

// Collection only: pending -> ready -> collected. Handing it over needs the money taken first.
export function vapeMoves(order) {
  switch (order.status) {
    case V.PENDING: return [V.READY]
    case V.READY: return order.paymentStatus === 'paid' ? [V.COLLECTED] : []
    case V.COLLECTED: return order.paymentStatus === 'paid' ? [V.REFUNDED] : []
    default: return []
  }
}

export const vapeCanCancel = (status) => status === V.PENDING || status === V.READY
