import { test } from 'node:test'
import assert from 'node:assert/strict'
import type Stripe from 'stripe'
import { isSettledCheckout } from '../src/lib/tickets'

function session(overrides: Partial<Stripe.Checkout.Session> = {}) {
  return { mode: 'payment', status: 'complete', payment_status: 'paid', amount_total: 1000, ...overrides } as Stripe.Checkout.Session
}

test('completed checkout with unpaid delayed payment does not grant access', () => {
  assert.equal(isSettledCheckout(session({ payment_status: 'unpaid' })), false)
})

test('confirmed payment grants access', () => {
  assert.equal(isSettledCheckout(session()), true)
})

test('a fully discounted completed purchase grants access', () => {
  assert.equal(isSettledCheckout(session({ payment_status: 'no_payment_required', amount_total: 0 })), true)
})

test('incomplete, expired, and non-payment sessions cannot grant access', () => {
  for (const overrides of [
    { status: 'open' }, { status: 'expired' }, { mode: 'subscription' }, { mode: 'setup' },
    { payment_status: 'no_payment_required', amount_total: 1000 },
    { payment_status: 'no_payment_required', amount_total: null },
  ] as Partial<Stripe.Checkout.Session>[]) {
    assert.equal(isSettledCheckout(session(overrides)), false)
  }
})
