import { test, expect } from 'vitest'
import { REPAIR_STATUS as S, allowedMoves, statusChangeError, quoteSent, customerStage, lineCost, unitProfit, marginPct, stockDeltas, shiftMinutes, dayEarners } from './rules.js'

const repair = (status, extra = {}) => ({ status, quote: null, history: [], paymentStatus: 'unpaid', ...extra })

test('staff follow the transition table', () => {
  expect(allowedMoves(S.BOOKED, 'staff')).toEqual([S.AWAITING, S.RECEIVED, S.CANCELLED])
  expect(allowedMoves(S.IN_PROGRESS, 'staff')).toEqual([S.PARTS, S.QA, S.CANCELLED])
  expect(allowedMoves(S.PARTS, 'staff')).toEqual([S.IN_PROGRESS, S.CANCELLED])
  expect(allowedMoves(S.READY, 'staff')).toEqual([S.COMPLETED, S.DISPATCHED, S.CANCELLED])
})

test('final states have no moves', () => {
  expect(allowedMoves(S.COMPLETED, 'staff')).toEqual([])
  expect(allowedMoves(S.CANCELLED, 'staff')).toEqual([])
})

test('staff cannot approve a quote for the customer, only cancel', () => {
  expect(allowedMoves(S.QUOTE, 'staff')).toEqual([S.CANCELLED])
  expect(statusChangeError(repair(S.QUOTE), S.IN_PROGRESS, 'staff')).toBeTruthy()
})

test('customer approves or declines a sent quote', () => {
  expect(statusChangeError(repair(S.QUOTE), S.IN_PROGRESS, 'customer')).toBeNull()
  expect(statusChangeError(repair(S.QUOTE), S.CANCELLED, 'customer', 'too dear')).toBeNull()
})

test('customer may cancel only before the device arrives', () => {
  expect(allowedMoves(S.BOOKED, 'customer')).toEqual([S.CANCELLED])
  expect(allowedMoves(S.AWAITING, 'customer')).toEqual([S.CANCELLED])
  for (const s of [S.RECEIVED, S.DIAGNOSTICS, S.IN_PROGRESS, S.READY]) expect(allowedMoves(s, 'customer')).toEqual([])
})

test('cancelling needs a reason', () => {
  expect(statusChangeError(repair(S.BOOKED), S.CANCELLED, 'staff', '  ')).toMatch(/reason/)
  expect(statusChangeError(repair(S.BOOKED), S.CANCELLED, 'staff', 'duplicate')).toBeNull()
})

test('sending a quote needs an amount above zero', () => {
  expect(statusChangeError(repair(S.DIAGNOSTICS), S.QUOTE, 'staff')).toMatch(/quote/i)
  expect(statusChangeError(repair(S.DIAGNOSTICS, { quote: 0 }), S.QUOTE, 'staff')).toMatch(/quote/i)
  expect(statusChangeError(repair(S.DIAGNOSTICS, { quote: 89 }), S.QUOTE, 'staff')).toBeNull()
})

test('skipping steps is refused', () => {
  expect(statusChangeError(repair(S.BOOKED), S.COMPLETED, 'staff')).toBeTruthy()
  expect(statusChangeError(repair(S.AWAITING), S.DIAGNOSTICS, 'staff')).toBeTruthy()
})

test('quote counts as sent once the status was reached, even after moving on', () => {
  expect(quoteSent(repair(S.DIAGNOSTICS))).toBe(false)
  expect(quoteSent(repair(S.QUOTE))).toBe(true)
  expect(quoteSent(repair(S.IN_PROGRESS, { history: [{ status: S.QUOTE }] }))).toBe(true)
})

test('customer stages are computed from status', () => {
  expect(customerStage(repair(S.DIAGNOSTICS)).key).toBe('with_us')
  expect(customerStage(repair(S.QA)).key).toBe('in_repair')
  expect(customerStage(repair(S.QUOTE)).nextStep).toBeTruthy()
  expect(customerStage(repair(S.READY)).label).toBe('Ready to collect')
  expect(customerStage(repair(S.DISPATCHED)).label).toBe('On its way to you')
  expect(customerStage(repair(S.COMPLETED, { history: [{ status: S.DISPATCHED }] })).key).toBe('done')
  expect(customerStage(repair(S.CANCELLED)).index).toBe(-1)
})

import { orderMoves, orderCanCancel, orderTotal } from './rules.js'

test('order moves differ for collection and delivery', () => {
  expect(orderMoves({ status: 'pending' })).toEqual(['processing'])
  expect(orderMoves({ status: 'processing', deliveryMethod: 'collection' })).toEqual(['ready'])
  expect(orderMoves({ status: 'processing', deliveryMethod: 'delivery' })).toEqual(['dispatched'])
  expect(orderMoves({ status: 'ready' })).toEqual(['collected'])
  expect(orderMoves({ status: 'dispatched' })).toEqual(['delivered'])
  expect(orderMoves({ status: 'cancelled' })).toEqual([])
})

test('only paid finished orders can be refunded', () => {
  expect(orderMoves({ status: 'collected', paymentStatus: 'paid' })).toEqual(['refunded'])
  expect(orderMoves({ status: 'collected', paymentStatus: 'unpaid' })).toEqual([])
})

test('cancel is refused once dispatched, delivered, collected or cancelled', () => {
  for (const s of ['pending', 'paid', 'processing', 'ready']) expect(orderCanCancel(s)).toBe(true)
  for (const s of ['dispatched', 'delivered', 'collected', 'cancelled', 'refunded']) expect(orderCanCancel(s)).toBe(false)
})

test('order total is exact to the penny', () => {
  expect(orderTotal([{ price: 0.1, qty: 3 }, { price: 0.2, qty: 1 }])).toBe(0.5)
  expect(orderTotal([{ price: 749, qty: 2 }, { price: 12.99, qty: 1 }])).toBe(1510.99)
})

import { tradeInMoves, tradeInChangeError, tradeInOfferSent, tradeInEditable } from './rules.js'

test('trade-in staff moves are exactly the next step, plus cancel', () => {
  expect(tradeInMoves('submitted', 'staff')).toEqual(['valuation_review', 'cancelled'])
  expect(tradeInMoves('valuation_review', 'staff')).toEqual(['offer_sent', 'cancelled'])
  expect(tradeInMoves('offer_accepted', 'staff')).toEqual(['paid', 'cancelled'])
  expect(tradeInMoves('paid', 'staff')).toEqual(['completed', 'cancelled'])
})

test('staff cannot accept or decline the offer for the customer', () => {
  expect(tradeInMoves('offer_sent', 'staff')).toEqual(['cancelled'])
  expect(tradeInMoves('offer_sent', 'customer')).toEqual(['offer_accepted', 'offer_declined'])
})

test('trade-in final states have no moves; customer may only withdraw when just submitted', () => {
  for (const s of ['completed', 'cancelled', 'offer_declined']) expect(tradeInMoves(s, 'staff')).toEqual([])
  expect(tradeInMoves('submitted', 'customer')).toEqual(['cancelled'])
  expect(tradeInMoves('valuation_review', 'customer')).toEqual([])
})

test('an offer needs an amount before it is sent', () => {
  expect(tradeInChangeError({ status: 'valuation_review' }, 'offer_sent', 'staff')).toMatch(/offer/i)
  expect(tradeInChangeError({ status: 'valuation_review', finalOffer: 120 }, 'offer_sent', 'staff')).toBeNull()
  expect(tradeInChangeError({ status: 'submitted' }, 'paid', 'staff')).toBeTruthy()
})

test('offer counts as sent once reached; values lock from then on', () => {
  expect(tradeInOfferSent({ status: 'valuation_review', history: [] })).toBe(false)
  expect(tradeInOfferSent({ status: 'offer_accepted', history: [{ status: 'offer_sent' }] })).toBe(true)
  expect(tradeInEditable({ status: 'valuation_review', history: [] })).toBe(true)
  expect(tradeInEditable({ status: 'offer_sent', history: [] })).toBe(false)
  expect(tradeInEditable({ status: 'cancelled', history: [] })).toBe(false)
})

import { pointsEarned, redemption, pointsForDiscount } from './rules.js'

test('earn 5 points per full £10, only when strictly over £10', () => {
  expect(pointsEarned(10)).toBe(0)
  expect(pointsEarned(11)).toBe(5)
  expect(pointsEarned(19.99)).toBe(5)
  expect(pointsEarned(20)).toBe(10)
  expect(pointsEarned(25)).toBe(10)
  expect(pointsEarned(0)).toBe(0)
  expect(pointsEarned(-5)).toBe(0)
})

test('redeem in steps of 10 points = £2, capped at 20% of the bill', () => {
  expect(redemption({ requested: 1000, balance: 1000, bill: 100 })).toEqual({ points: 100, discount: 20 })
  expect(redemption({ requested: 10, balance: 50, bill: 10 })).toEqual({ points: 10, discount: 2 })
  expect(redemption({ requested: 50, balance: 50, bill: 9.99 })).toEqual({ points: 0, discount: 0 })
})

test('over-asking is trimmed to balance and to whole steps; never negative', () => {
  expect(redemption({ requested: 15, balance: 100, bill: 100 })).toEqual({ points: 10, discount: 2 })
  expect(redemption({ requested: 100, balance: 25, bill: 100 })).toEqual({ points: 20, discount: 4 })
  expect(redemption({ requested: -10, balance: 100, bill: 100 }).points).toBe(0)
  expect(redemption({ requested: 'x', balance: 100, bill: 100 }).points).toBe(0)
  expect(redemption({ requested: 100, balance: 5, bill: 100 }).points).toBe(0)
})

test('undoing a discount returns the same points', () => {
  expect(pointsForDiscount(2)).toBe(10)
  expect(pointsForDiscount(20)).toBe(100)
})

import { revenueWhere } from './rules.js'

test('revenue counts only paid orders that are not cancelled or refunded', () => {
  const sql = revenueWhere('o')
  expect(sql).toContain("o.payment_status = 'paid'")
  expect(sql).toContain("o.status NOT IN ('cancelled', 'refunded')")
  expect(revenueWhere()).toBe("payment_status = 'paid' AND status NOT IN ('cancelled', 'refunded')")
})

import { repairPayError, repairAmountDue, repairTakingsWhere } from './rules.js'

test('a repair cannot be completed until it is paid', () => {
  expect(statusChangeError(repair(S.READY, { quote: 80 }), S.COMPLETED, 'staff')).toMatch(/paid/i)
  expect(statusChangeError(repair(S.READY, { quote: 80, paymentStatus: 'paid' }), S.COMPLETED, 'staff')).toBeNull()
  expect(statusChangeError(repair(S.DISPATCHED, { quote: 80 }), S.COMPLETED, 'staff')).toMatch(/paid/i)
})

test('payment is only taken once the repair is ready, with a quote, and only once', () => {
  expect(repairPayError(repair(S.READY, { quote: 80 }))).toBeNull()
  expect(repairPayError(repair(S.DISPATCHED, { quote: 80 }))).toBeNull()
  expect(repairPayError(repair(S.QA, { quote: 80 }))).toMatch(/ready/i)
  expect(repairPayError(repair(S.READY))).toMatch(/quote/i)
  expect(repairPayError(repair(S.READY, { quote: 80, paymentStatus: 'paid' }))).toMatch(/already/i)
})

test('amount due is the quote less the loyalty discount', () => {
  expect(repairAmountDue({ quote: 100, loyaltyDiscount: 20 })).toBe(80)
  expect(repairAmountDue({ quote: 99.99 })).toBe(99.99)
})

test('repair takings count paid repairs only', () => {
  expect(repairTakingsWhere('r')).toBe("r.payment_status = 'paid'")
})


test('prices a delivery line: 100 pieces at £10 = £1000', () => expect(lineCost(100, 10)).toBe(1000))
test('profit and margin: bought at £10, sold at £20', () => {
    expect(unitProfit(20, 10)).toBe(10)
    expect(marginPct(20, 10)).toBe(50)
    expect(unitProfit(8, 10)).toBe(-2)
    expect(unitProfit(20, null)).toBeNull()
    expect(marginPct(0, 5)).toBeNull()
  })
test('stock deltas are the net change of an edit', () => {
    expect(stockDeltas([{ productId: 1, qty: 10 }, { productId: 2, qty: 5 }], [{ productId: 1, qty: 12 }, { productId: 3, qty: 4 }]))
      .toEqual([[1, 2], [2, -5], [3, 4]])
    expect(stockDeltas([{ productId: 1, qty: 3 }], [{ productId: 1, qty: 3 }])).toEqual([])
  })

test('shift minutes', () => {
  const at = (h, m = 0) => new Date(Date.UTC(2026, 0, 5, h, m))
  expect(shiftMinutes(at(9), at(10, 30))).toBe(90)
  expect(shiftMinutes(at(9), at(9, 0))).toBe(0)
  expect(shiftMinutes(at(10), at(9))).toBe(0)
  expect(shiftMinutes(new Date(at(9).getTime() - 59_999), at(9))).toBe(0)
})

test('a day pays once, on its first shift', () => {
  const shift = (id, userId, day, h) => ({ id, userId, day, startedAt: new Date(Date.UTC(2026, 0, 5, h)) })
  const earners = dayEarners([shift(1, 7, '2026-01-05', 14), shift(2, 7, '2026-01-05', 9), shift(3, 7, '2026-01-06', 9), shift(4, 8, '2026-01-05', 9)])
  expect([...earners].sort()).toEqual([2, 3, 4]) // two shifts on the 5th pay once (the 9am one); other days and people pay on their own
})
