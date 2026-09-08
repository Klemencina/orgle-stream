import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { createFestivalCheckout } from '../src/lib/festival-checkout'
import { createCheckout } from '../src/lib/checkout'
import { fulfillCheckout, closeUnpaidCheckout } from '../src/lib/tickets'
import { hasConcertAccess } from '../src/lib/festival-pass'
import { listPurchasedConcerts } from '../src/lib/purchased-concerts'
import { getStreamResponse } from '../src/lib/stream-access'

const url = new URL(process.env.TEST_DATABASE_URL || 'file:///missing')
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/orgle_test') throw new Error('Tests require a local orgle_test database')
const db = new PrismaClient({ datasourceUrl: url.toString() })
const users: string[] = []
const concerts: string[] = []
after(async () => {
  await db.festivalPass.deleteMany({ where: { userId: { in: users } } })
  await db.concert.deleteMany({ where: { id: { in: concerts } } })
  await db.$disconnect()
})
const config = { year: 2090, priceId: 'price_pass' }
async function addConcert(date = '2090-10-11T18:00:00Z', isVisible = true) {
  const concert = await db.concert.create({ data: { id: randomUUID(), date: new Date(date), isVisible, stripePriceId: 'price_single', translations: { create: { locale: 'en', title: 'Test festival concert', venue: '', description: '' } } } })
  concerts.push(concert.id)
  return concert
}
async function fixture(onCreate?: (session: Stripe.Checkout.Session) => Promise<void>) {
  const concert = await addConcert()
  const userId = randomUUID()
  users.push(userId)
  const sessions = new Map<string, Stripe.Checkout.Session>()
  const stripe = { prices: { retrieve: async () => ({ active: true, type: 'one_time', unit_amount: 4000, currency: 'eur' }) }, checkout: { sessions: {
    retrieve: async (id: string) => {
      const session = [...sessions.values()].find(s => s.id === id)
      if (!session) throw new Error('Unknown session')
      return session
    },
    create: async (params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => {
      const key = options.idempotencyKey!
      let session = sessions.get(key)
      if (!session) {
        assert.equal(params.line_items?.[0].price, config.priceId)
        assert.ok(params.success_url?.startsWith('https://festival.example/en/concerts/'))
        session = { id: `cs_${randomUUID()}`, status: 'open', mode: 'payment', payment_status: 'unpaid', amount_total: 4000, currency: 'eur', url: 'https://checkout.stripe.com/test', metadata: params.metadata } as Stripe.Checkout.Session
        sessions.set(key, session)
      }
      await onCreate?.(session)
      return session
    },
  } } } as unknown as Stripe
  return { concert, userId, sessions, stripe, input: { userId, concertId: concert.id, locale: 'en', appUrl: 'https://festival.example' } }
}
function settled(session: Stripe.Checkout.Session): Stripe.Checkout.Session {
  return { ...session, status: 'complete', payment_status: 'paid' }
}
async function buy(f: Awaited<ReturnType<typeof fixture>>) {
  await createFestivalCheckout(db, f.stripe, f.input, config)
  const session = [...f.sessions.values()][0]
  await fulfillCheckout(db, settled(session))
  return session
}

test('parallel pass checkouts create one order and one Stripe attempt', async () => {
  const f = await fixture()
  const results = await Promise.all(Array.from({ length: 8 }, () => createFestivalCheckout(db, f.stripe, f.input, config)))
  assert.equal(f.sessions.size, 1)
  assert.equal(new Set(results.map(r => 'id' in r ? r.id : '')).size, 1)
  assert.equal(await db.festivalPass.count({ where: { userId: f.userId } }), 1)
})

test('concurrent fulfillment unlocks the year, including later additions, and preserves single tickets', async () => {
  const f = await fixture()
  const ticket = await db.ticket.create({ data: { userId: f.userId, concertId: f.concert.id, status: 'paid', amountCents: 1200 } })
  await createFestivalCheckout(db, f.stripe, f.input, config)
  const session = [...f.sessions.values()][0]
  await Promise.all(Array.from({ length: 8 }, () => fulfillCheckout(db, settled(session))))
  const later = await addConcert('2090-11-15T18:00:00Z')
  const nextYear = await addConcert('2091-10-11T18:00:00Z')
  const previousYear = await addConcert('2089-10-11T18:00:00Z')
  assert.equal(await hasConcertAccess(db, f.userId, later), true)
  assert.equal(await hasConcertAccess(db, f.userId, nextYear), false)
  assert.equal(await hasConcertAccess(db, f.userId, previousYear), false)
  assert.equal(await hasConcertAccess(db, 'another-user', later), false)
  assert.deepEqual(await db.ticket.findUnique({ where: { id: ticket.id } }), ticket)
  assert.equal(await db.ticket.count({ where: { userId: f.userId } }), 1)
  assert.equal((await db.festivalPass.findFirstOrThrow({ where: { userId: f.userId } })).amountCents, 4000)
})

test('unpaid completion gives no access; paid and fully discounted confirmations do', async () => {
  for (const free of [false, true]) {
    const f = await fixture()
    await createFestivalCheckout(db, f.stripe, f.input, config)
    const session = [...f.sessions.values()][0]
    await fulfillCheckout(db, { ...session, status: 'complete' })
    assert.equal(await hasConcertAccess(db, f.userId, f.concert), false)
    await fulfillCheckout(db, { ...settled(session), ...(free ? { amount_total: 0, payment_status: 'no_payment_required' as const } : {}) })
    assert.equal(await hasConcertAccess(db, f.userId, f.concert), true)
    assert.equal((await db.festivalPass.findFirstOrThrow({ where: { userId: f.userId } })).amountCents, free ? 0 : 4000)
  }
})

test('webhook arriving before checkout response cannot be reset to pending', async () => {
  const f = await fixture(async session => { await fulfillCheckout(db, settled(session)) })
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input, config), { alreadyOwned: true })
})

test('open sessions are reused, delayed payments block retries, and failed attempts can restart', async () => {
  const f = await fixture()
  const first = await createFestivalCheckout(db, f.stripe, f.input, config)
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input, config), first)
  const session = [...f.sessions.values()][0]
  session.status = 'complete'
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input, config), /still being processed/)
  await closeUnpaidCheckout(db, session, 'failed')
  await createFestivalCheckout(db, f.stripe, f.input, config)
  assert.equal(f.sessions.size, 2)
  await closeUnpaidCheckout(db, session, 'expired')
  assert.equal((await db.festivalPass.findFirstOrThrow({ where: { userId: f.userId } })).status, 'pending')
})

test('revoked passes stay revoked after replay and never authorize streaming', async () => {
  const f = await fixture()
  const session = await buy(f)
  await closeUnpaidCheckout(db, session, 'expired')
  assert.equal(await hasConcertAccess(db, f.userId, f.concert), true)
  await db.festivalPass.updateMany({ where: { userId: f.userId }, data: { status: 'refunded' } })
  await fulfillCheckout(db, settled(session))
  assert.equal(await hasConcertAccess(db, f.userId, f.concert), false)
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input, config), /contact support/)
})

test('fulfillment requires matching server-created order metadata', async () => {
  const f = await fixture()
  await createFestivalCheckout(db, f.stripe, f.input, config)
  const session = settled([...f.sessions.values()][0])
  for (const override of [{ userId: 'someone-else' }, { year: '2091' }, { priceId: 'price_wrong' }, { passId: 'missing' }] as Record<string, string>[]) {
    assert.equal(await fulfillCheckout(db, { ...session, metadata: { ...session.metadata, ...override } }), false)
  }
  assert.equal(await hasConcertAccess(db, f.userId, f.concert), false)
})

test('pass owners cannot start another pass or individual ticket checkout', async () => {
  const f = await fixture()
  await buy(f)
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input, config), { alreadyOwned: true })
  assert.deepEqual(await createCheckout(db, f.stripe, f.input), { alreadyOwned: true })
  assert.equal(f.sessions.size, 1)
  assert.equal(await db.ticket.count({ where: { userId: f.userId } }), 0)
})

test('pass holders still need a visible concert and an open viewing window', async () => {
  const f = await fixture()
  await buy(f)
  const options = { db, concertId: f.concert.id, getUserId: async () => f.userId, isAdmin: async () => false, adminPreview: false, checkOnly: false, checkAvailability: async () => true, playbackUrl: 'https://example.com/test.m3u8' }
  assert.equal((await getStreamResponse({ ...options, now: f.concert.date.getTime() })).status, 200)
  assert.equal((await getStreamResponse({ ...options, now: f.concert.date.getTime() + 86400000 })).status, 403)
  await db.concert.update({ where: { id: f.concert.id }, data: { isVisible: false } })
  assert.equal((await getStreamResponse({ ...options, now: f.concert.date.getTime() })).status, 404)
})

test('dashboard lists pass concerts once, hides archived concerts and shows the pass price once', async () => {
  const f = await fixture()
  await buy(f)
  await db.ticket.create({ data: { userId: f.userId, concertId: f.concert.id, status: 'paid', amountCents: 1200 } })
  const later = await addConcert('2090-11-15T18:00:00Z')
  const hidden = await addConcert('2090-11-20T18:00:00Z', false)
  const next = await addConcert('2091-11-15T18:00:00Z')
  const result = await listPurchasedConcerts(db, f.userId, 'en', 'upcoming')
  assert.equal(result.items.filter(i => i.concertId === f.concert.id).length, 1)
  assert.equal(result.items.find(i => i.concertId === f.concert.id)?.amountCents, 1200)
  assert.equal(result.items.find(i => i.concertId === later.id)?.passYear, 2090)
  assert.equal(result.items.some(i => [hidden.id, next.id].includes(i.concertId)), false)
  assert.equal(result.passes.length, 1)
  assert.equal(result.passes[0].amountCents, 4000)
})

test('disabled sales and concerts from a different year cannot create pass orders', async () => {
  const f = await fixture()
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input, null), /not configured/)
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input, { ...config, year: 2089 }), /not included/)
  assert.equal(await db.festivalPass.count({ where: { userId: f.userId } }), 0)
})
