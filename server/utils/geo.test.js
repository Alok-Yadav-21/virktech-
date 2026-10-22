import { test, expect } from 'vitest'
import { distanceMiles, byDistance } from './geo.js'

const WOOLWICH = { lat: 51.4894, lng: 0.064 }
const ORPINGTON = { lat: 51.399, lng: 0.106 }

test('distance: zero for same point, ~6-7 miles Woolwich to Orpington, symmetric', () => {
  expect(distanceMiles(WOOLWICH, WOOLWICH)).toBe(0)
  const d = distanceMiles(WOOLWICH, ORPINGTON)
  expect(d).toBeGreaterThan(5.5)
  expect(d).toBeLessThan(8)
  expect(d).toBeCloseTo(distanceMiles(ORPINGTON, WOOLWICH), 6)
})

test('missing coordinates give null, not NaN', () => {
  expect(distanceMiles(WOOLWICH, { lat: null, lng: null })).toBeNull()
  expect(distanceMiles(null, WOOLWICH)).toBeNull()
})

test('byDistance sorts nearest first and puts unknowns last', () => {
  const list = [{ n: 'none' }, { n: 'far', ...ORPINGTON }, { n: 'near', ...WOOLWICH }]
  expect(byDistance(list, WOOLWICH).map((b) => b.n)).toEqual(['near', 'far', 'none'])
})
