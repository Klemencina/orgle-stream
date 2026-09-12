import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGroup } from '../src/lib/concert-groups'

test('draft groups need no Stripe configuration or concerts', () => {
  assert.deepEqual(parseGroup({ name: '  Autumn  ', salesEnabled: false, concertIds: [] }), { name: 'Autumn', salesEnabled: false, concertIds: [], stripePriceId: null })
})

test('sales require explicit membership and a Stripe price', () => {
  const input = { name: 'Autumn', salesEnabled: true, concertIds: ['concert'], stripePriceId: 'price_test' }
  assert.deepEqual(parseGroup(input), input)
  for (const override of [{ concertIds: [] }, { concertIds: [123] }, { stripePriceId: '' }, { stripePriceId: 'prod_test' }, { name: '' }, { salesEnabled: 'true' }]) {
    assert.throws(() => parseGroup({ ...input, ...override }))
  }
})
