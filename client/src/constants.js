// Mirrors server/utils/rules.js. Never hard-code these strings in a page.
export const ROLES = { CUSTOMER: 'customer', STAFF: 'staff', ADMIN: 'admin' }

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
const R = REPAIR_STATUS
export const REPAIR_STATUSES = Object.values(R)

// Bootstrap colour per status, for badges.
export const STATUS_COLOUR = {
  [R.BOOKED]: 'primary', [R.AWAITING]: 'secondary', [R.RECEIVED]: 'info', [R.DIAGNOSTICS]: 'warning',
  [R.QUOTE]: 'warning', [R.IN_PROGRESS]: 'warning', [R.PARTS]: 'info', [R.QA]: 'info',
  [R.READY]: 'success', [R.DISPATCHED]: 'success', [R.COMPLETED]: 'secondary', [R.CANCELLED]: 'danger',
}

// Labels for the customer timeline. The server decides which stage a repair is in (and the
// "On its way" wording); this list is only the steps to draw.
export const CUSTOMER_STAGES = [
  'Booking confirmed', 'Waiting for your device', 'Device with us', 'Your approval needed',
  'Being repaired', 'Ready to collect', 'Completed',
]

export const ORDER_STATUS = {
  PENDING: 'pending', PAID: 'paid', PROCESSING: 'processing', READY: 'ready', DISPATCHED: 'dispatched',
  DELIVERED: 'delivered', COLLECTED: 'collected', CANCELLED: 'cancelled', REFUNDED: 'refunded',
}
export const ORDER_LABELS = {
  pending: 'Pending', paid: 'Paid', processing: 'Processing', ready: 'Ready', dispatched: 'Dispatched',
  delivered: 'Delivered', collected: 'Collected', cancelled: 'Cancelled', refunded: 'Refunded',
}
// Said to the person who placed the order.
export const ORDER_CUSTOMER_LABELS = {
  pending: 'Order placed', paid: 'Paid', processing: 'Being prepared', ready: 'Ready to collect',
  dispatched: 'On its way to you', delivered: 'Delivered', collected: 'Collected', cancelled: 'Cancelled', refunded: 'Refunded',
}
export const ORDER_COLOUR = {
  pending: 'warning', paid: 'primary', processing: 'info', ready: 'success', dispatched: 'success',
  delivered: 'secondary', collected: 'secondary', cancelled: 'danger', refunded: 'dark',
}
export const DELIVERY_LABELS = { collection: 'Collection', delivery: 'Delivery' }
export const PAYMENT_LABELS = { cash: 'Cash', card_in_store: 'Card (paid at the counter or on delivery)' }

export const TRADEIN_STATUS = {
  SUBMITTED: 'submitted', REVIEW: 'valuation_review', OFFER_SENT: 'offer_sent', ACCEPTED: 'offer_accepted',
  DECLINED: 'offer_declined', PAID: 'paid', COMPLETED: 'completed', CANCELLED: 'cancelled',
}
export const TRADEIN_LABELS = {
  submitted: 'Submitted', valuation_review: 'Valuation', offer_sent: 'Offer sent', offer_accepted: 'Offer accepted',
  offer_declined: 'Offer declined', paid: 'Paid', completed: 'Completed', cancelled: 'Cancelled',
}
// Said to the person selling the device.
export const TRADEIN_CUSTOMER_LABELS = {
  submitted: 'Request confirmed', valuation_review: 'Being valued', offer_sent: 'Your offer is ready',
  offer_accepted: 'Offer accepted', offer_declined: 'Offer declined', paid: 'Payment on its way',
  completed: 'Completed', cancelled: 'Cancelled',
}
export const TRADEIN_NEXT_STEP = {
  offer_sent: 'Review your offer and accept or decline it.',
  offer_accepted: 'Send us the device, or bring it into your branch, and we will pay you.',
}
export const TRADEIN_COLOUR = {
  submitted: 'primary', valuation_review: 'warning', offer_sent: 'warning', offer_accepted: 'success',
  offer_declined: 'danger', paid: 'success', completed: 'secondary', cancelled: 'danger',
}
export const TRADEIN_CONDITIONS = ['Like new', 'Good', 'Fair', 'Poor']

// Display-only copy of server/utils/rules.js redemption(): the server always decides the real amount.
export const LOYALTY = { STEP_POINTS: 10, STEP_VALUE: 2, MAX_SHARE: 0.2 }
export function redemption({ requested, balance, bill }) {
  const asked = Math.floor(Number(requested) / LOYALTY.STEP_POINTS)
  const owned = Math.floor(Number(balance) / LOYALTY.STEP_POINTS)
  const capped = Math.floor((Math.round(Number(bill) * 100) * LOYALTY.MAX_SHARE) / (LOYALTY.STEP_VALUE * 100))
  const steps = Math.max(0, Math.min(asked || 0, owned || 0, capped || 0))
  return { points: steps * LOYALTY.STEP_POINTS, discount: steps * LOYALTY.STEP_VALUE }
}

export const FULFILMENT_LABELS = { in_store: 'In-store drop-off', collection: 'We collect from you', mail_in: 'Post it to us' }
export const DEVICE_CATEGORIES = ['Phone', 'Laptop', 'Tablet', 'Audio', 'Wearable', 'Other']

// Where each role lands after login, and the navigation for that workspace. `section` starts a labelled group in the
// staff/admin sidebar. Customers use a bottom tab bar on phones (see CustomerShell) and this list on desktop.
export const WORKSPACE = {
  customer: {
    home: '/app',
    links: [
      { to: '/app', label: 'Home', icon: 'home', end: true },
      { to: '/app/repairs', label: 'Repairs', icon: 'wrench' },
      { to: '/app/orders', label: 'Orders', icon: 'receipt' },
      { to: '/app/tradeins', label: 'Trade-ins', icon: 'swap' },
      { to: '/app/loyalty', label: 'Rewards', icon: 'gift' },
    ],
  },
  staff: {
    home: '/staff',
    links: [
      { to: '/staff', label: 'Dashboard', icon: 'home', end: true },
      { to: '/staff/repairs', label: 'Repairs', icon: 'wrench' },
      { to: '/staff/orders', label: 'Orders', icon: 'receipt' },
      { to: '/staff/tradeins', label: 'Trade-ins', icon: 'swap' },
      { section: 'Inventory', to: '/staff/stock', label: 'Stock & deliveries', icon: 'box' },
      { section: 'Vapes (18+)', to: '/staff/vapes', label: 'Vape dashboard', icon: 'drop', end: true },
      { to: '/staff/vapes/orders', label: 'Vape orders', icon: 'receipt' },
      { to: '/staff/loyalty', label: 'Counter loyalty', icon: 'gift' },
    ],
  },
  admin: {
    home: '/admin',
    links: [
      { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
      { to: '/admin/repairs', label: 'Repairs', icon: 'wrench' },
      { to: '/admin/orders', label: 'Orders', icon: 'receipt' },
      { to: '/admin/tradeins', label: 'Trade-ins', icon: 'swap' },
      { to: '/admin/loyalty', label: 'Loyalty adjust', icon: 'gift' },
      { section: 'Catalogue', to: '/admin/products', label: 'Products', icon: 'bag' },
      { to: '/admin/categories', label: 'Categories', icon: 'tag' },
      { to: '/admin/services', label: 'Services', icon: 'list' },
      { section: 'Inventory', to: '/admin/stock', label: 'Stock by branch', icon: 'box' },
      { to: '/admin/deliveries', label: 'Deliveries', icon: 'list' },
      { to: '/admin/profit', label: 'Profit', icon: 'chart' },
      { to: '/admin/reports', label: 'Reports', icon: 'chart' },
      { section: 'Vapes (18+)', to: '/admin/vapes', label: 'Vape dashboard', icon: 'drop', end: true },
      { to: '/admin/vapes/orders', label: 'Vape orders', icon: 'receipt' },
      { to: '/admin/vapes/products', label: 'Vape products', icon: 'bag' },
      { to: '/admin/vapes/brands', label: 'Vape brands', icon: 'tag' },
      { to: '/admin/vapes/stock', label: 'Vape stock', icon: 'box' },
      { to: '/admin/vapes/deliveries', label: 'Vape deliveries', icon: 'list' },
      { to: '/admin/vapes/profit', label: 'Vape profit', icon: 'chart' },
      { section: 'People and places', to: '/admin/branches', label: 'Branches', icon: 'pin' },
      { to: '/admin/staff', label: 'Staff', icon: 'users' },
      { to: '/admin/hours', label: 'Hours & wages', icon: 'list' },
      { to: '/admin/customers', label: 'Customers', icon: 'user' },
    ],
  },
}

// Photo for each shop category tile (files in public/img). Unknown categories fall back to a neutral tile.
export const CATEGORY_IMAGES = {
  iPhones: '/img/iphone-trio.jpg', Smartphones: '/img/samsung.jpg', Laptops: '/img/laptop.jpg', MacBooks: '/img/macbook.jpg',
  Tablets: '/img/tablet-ipad.jpg', Audio: '/img/headphones.jpg', Wearables: '/img/watch.jpg', Accessories: '/img/charger.jpg',
}

// "What needs fixing?" shortcuts on the home page; each one pre-fills the booking form.
export const REPAIR_ISSUES = [
  { label: 'Cracked screen', icon: 'crack', problem: 'Cracked screen' },
  { label: 'Battery', icon: 'battery', problem: 'Battery drains fast or will not hold charge' },
  { label: 'Charging port', icon: 'bolt', problem: 'Will not charge or the charging port is loose' },
  { label: 'Water damage', icon: 'drop', problem: 'Water damage' },
  { label: 'Camera', icon: 'camera', problem: 'Camera not working' },
  { label: 'Something else', icon: 'wrench', problem: '' },
]

export const CONDITIONS = ['New', 'Refurbished', 'Used']
export const SORTS = [['featured', 'Featured'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['saving', 'Biggest saving']]
export const PRICE_BANDS = [['0-50', 'Under £50'], ['50-200', '£50 to £200'], ['200-500', '£200 to £500'], ['500-', '£500 and over']]

// Mirrors the server's notion of "still needs doing", used only to group things on the customer home screen.
export const OPEN = {
  repairs: (s) => ![REPAIR_STATUS.COMPLETED, REPAIR_STATUS.CANCELLED].includes(s),
  orders: (s) => !['delivered', 'collected', 'cancelled', 'refunded'].includes(s),
  tradeins: (s) => !['completed', 'cancelled', 'offer_declined'].includes(s),
}

// Pill tone per status (the words always say what it is; colour only helps scanning).
export const REPAIR_TONE = {
  [REPAIR_STATUS.BOOKED]: 'brand', [REPAIR_STATUS.AWAITING]: 'info', [REPAIR_STATUS.RECEIVED]: 'info', [REPAIR_STATUS.DIAGNOSTICS]: 'info',
  [REPAIR_STATUS.QUOTE]: 'warn', [REPAIR_STATUS.IN_PROGRESS]: 'info', [REPAIR_STATUS.PARTS]: 'info', [REPAIR_STATUS.QA]: 'info',
  [REPAIR_STATUS.READY]: 'success', [REPAIR_STATUS.DISPATCHED]: 'success', [REPAIR_STATUS.COMPLETED]: 'done', [REPAIR_STATUS.CANCELLED]: 'danger',
}
export const STAGE_TONE = { booked: 'brand', awaiting_device: 'info', with_us: 'info', approval: 'warn', in_repair: 'info', ready: 'success', done: 'done', cancelled: 'danger' }
export const ORDER_TONE = { pending: 'warn', paid: 'brand', processing: 'info', ready: 'success', dispatched: 'success', delivered: 'done', collected: 'done', cancelled: 'danger', refunded: 'danger' }
export const TRADEIN_TONE = { submitted: 'brand', valuation_review: 'info', offer_sent: 'warn', offer_accepted: 'success', offer_declined: 'danger', paid: 'success', completed: 'done', cancelled: 'danger' }
