import assert from 'node:assert/strict'
import test from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { listPurchasedConcerts } from '../src/lib/purchased-concerts'

test('overlapping passes keep their full membership while the concert list stays unique', async () => {
  const now = Date.now()
  const concert = (id: string, offset: number) => ({
    id, date: new Date(now + offset),
    translations: [{ title: 'Organ concert', subtitle: id, venue: 'Koper' }],
  })
  const past = concert('past', -86_400_000)
  const shared = concert('shared', 86_400_000)
  const later = concert('later', 172_800_000)
  const pass = (id: string, concerts: ReturnType<typeof concert>[]) => ({
    id, createdAt: new Date(now), amountCents: 4000, currency: 'eur',
    group: { name: id, nameEn: `English ${id}`, concerts },
  })
  const db = {
    ticket: { findMany: async () => [] },
    festivalPass: { findMany: async () => [pass('one', [past, shared]), pass('two', [shared, later])] },
  } as unknown as PrismaClient

  const result = await listPurchasedConcerts(db, 'viewer', 'en', 'all')
  assert.deepEqual(result.items.map(item => item.concertId), ['past', 'shared', 'later'])
  assert.deepEqual(result.passes.map(pass => pass.concerts.map(concert => concert.concertId)), [['past', 'shared'], ['shared', 'later']])
  assert.equal(result.passes[0].name, 'English one')
  assert.equal(result.passes[0].concerts[1].subtitle, 'shared')

  const upcoming = await listPurchasedConcerts(db, 'viewer', 'en', 'upcoming')
  assert.deepEqual(upcoming.items.map(item => item.concertId), ['shared', 'later'])
  assert.equal(upcoming.passes[0].concerts.length, 2)
  const history = await listPurchasedConcerts(db, 'viewer', 'en', 'past')
  assert.deepEqual(history.items.map(item => item.concertId), ['past'])
})
