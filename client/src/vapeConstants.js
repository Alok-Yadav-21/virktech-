import { WORKSPACE } from './constants'

// Mirrors server/utils/vapeRules.js. Status labels and tones reuse ORDER_LABELS / ORDER_TONE (same keys).
export const VAPE_KINDS = ['Pod kit', 'Refill pod', 'E-liquid', 'Coil', 'Accessory']
export const FLAVOUR_GROUPS = ['Fruit', 'Menthol & ice', 'Tobacco', 'Sweet & dessert', 'Drinks', 'Unflavoured']
export const MAX_QTY = 20
export const VAPE_STATUSES = { pending: 'Pending', ready: 'Ready', collected: 'Collected', cancelled: 'Cancelled', refunded: 'Refunded' }
export const VAPE_CUSTOMER_STATUSES = { pending: 'Order placed', ready: 'Ready to collect', collected: 'Collected', cancelled: 'Cancelled', refunded: 'Refunded' }

export const nicotineLabel = (mg) => (mg ? `${mg}mg` : 'Nicotine free')

// Where vape order pages live for each role.
export const vapeOrdersBase = (role) => (role === 'customer' ? '/app/vape-orders' : `${WORKSPACE[role].home}/vapes/orders`)
export const vapeBase = (role) => `${WORKSPACE[role].home}/vapes`
