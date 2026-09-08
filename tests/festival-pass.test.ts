import test from 'node:test'
import assert from 'node:assert/strict'
import { festivalDates, festivalYear, getFestivalPassConfig } from '../src/lib/festival-pass'

test('festival years follow Slovenia at the year boundary', () => {
  assert.equal(festivalYear(new Date('2026-12-31T22:59:59Z')), 2026)
  assert.equal(festivalYear(new Date('2026-12-31T23:00:00Z')), 2027)
  assert.deepEqual(festivalDates(2026), { gte: new Date('2025-12-31T23:00:00Z'), lt: new Date('2026-12-31T23:00:00Z') })
})

test('pass sales require an explicit year and Stripe price', () => {
  assert.equal(getFestivalPassConfig({}), null)
  assert.equal(getFestivalPassConfig({ FESTIVAL_PASS_YEAR: '2026' }), null)
  for (const year of ['2026.5', '2025', 'NaN', '']) assert.equal(getFestivalPassConfig({ FESTIVAL_PASS_YEAR: year, FESTIVAL_PASS_STRIPE_PRICE_ID: 'price_test' }), null)
  assert.deepEqual(getFestivalPassConfig({ FESTIVAL_PASS_YEAR: '2026', FESTIVAL_PASS_STRIPE_PRICE_ID: 'price_test' }), { year: 2026, priceId: 'price_test' })
})
