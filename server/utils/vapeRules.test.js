import { test, expect } from 'vitest'
import { readFileSync } from 'fs'
import { vapeMoves, vapeCanCancel, VAPE_STATUSES, VAPE_KINDS, FLAVOUR_GROUPS, VAPE_PAYMENT_METHODS, MAX_NICOTINE_MG } from './vapeRules.js'

test('vape orders go pending, ready, collected; collecting needs payment first', () => {
  expect(vapeMoves({ status: 'pending', paymentStatus: 'unpaid' })).toEqual(['ready'])
  expect(vapeMoves({ status: 'ready', paymentStatus: 'unpaid' })).toEqual([])
  expect(vapeMoves({ status: 'ready', paymentStatus: 'paid' })).toEqual(['collected'])
  expect(vapeMoves({ status: 'collected', paymentStatus: 'paid' })).toEqual(['refunded'])
  expect(vapeMoves({ status: 'cancelled', paymentStatus: 'refunded' })).toEqual([])
})

test('only orders still in the shop can be cancelled', () => {
  expect(['pending', 'ready'].every(vapeCanCancel)).toBe(true)
  expect(['collected', 'cancelled', 'refunded'].some(vapeCanCancel)).toBe(false)
})

test('the schema allows every status, kind, flavour group and payment method in vapeRules.js', () => {
  const sql = readFileSync(new URL('../migrations/003_vapes.sql', import.meta.url), 'utf8')
  for (const v of [...VAPE_STATUSES, ...VAPE_KINDS, ...FLAVOUR_GROUPS, ...VAPE_PAYMENT_METHODS]) expect(sql, `schema is missing '${v}'`).toContain(`'${v}'`)
  expect(sql).toContain(`BETWEEN 0 AND ${MAX_NICOTINE_MG}`)
})
