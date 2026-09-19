import test from 'node:test';
import assert from 'node:assert/strict';
import { individualTicketTotal } from '../src/lib/festival-pricing';

const price = { active: true, type: 'one_time', unit_amount: 1000, currency: 'eur' };

test('five €10 tickets total €50 for comparison with the festival pass', () => {
  assert.equal(individualTicketTotal(Array(5).fill(price), 'eur'), 5000);
});

test('incomplete or incompatible prices cannot produce a savings claim', () => {
  for (const invalid of [null, { ...price, active: false }, { ...price, type: 'recurring' }, { ...price, unit_amount: null }, { ...price, currency: 'usd' }]) {
    assert.equal(individualTicketTotal([price, invalid], 'eur'), null);
  }
  assert.equal(individualTicketTotal([], 'eur'), null);
  assert.equal(individualTicketTotal([{ ...price, unit_amount: 0 }, price], 'eur'), 1000);
});
