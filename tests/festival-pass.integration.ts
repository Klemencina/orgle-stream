import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { createFestivalCheckout, festivalOfferPriceId } from '../src/lib/festival-checkout'
import { createCheckout } from '../src/lib/checkout'
import { fulfillCheckout, closeUnpaidCheckout } from '../src/lib/tickets'
import { hasConcertAccess } from '../src/lib/festival-pass'
import { listPurchasedConcerts } from '../src/lib/purchased-concerts'
import { saveConcertGroup } from '../src/lib/concert-groups'
import { getStreamResponse } from '../src/lib/stream-access'

const url = new URL(process.env.TEST_DATABASE_URL || 'file:///missing')
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/orgle_test') throw new Error('Tests require a local orgle_test database')
const db = new PrismaClient({ datasourceUrl: url.toString() })
const users: string[] = []
const concerts: string[] = []
const groups: string[] = []
after(async () => {
  await db.festivalPass.deleteMany({ where: { userId: { in: users } } })
  await db.concertGroup.deleteMany({ where: { id: { in: groups } } })
  await db.concert.deleteMany({ where: { id: { in: concerts } } })
  await db.$disconnect()
})
const config = { priceId: 'price_pass' }
async function addConcert(date = '2090-10-11T18:00:00Z', isVisible = true) {
  const concert = await db.concert.create({ data: { id: randomUUID(), date: new Date(date), isVisible, stripePriceId: 'price_single', translations: { create: { locale: 'en', title: 'Test festival concert', venue: '', description: '' } } } })
  concerts.push(concert.id)
  return concert
}
async function fixture(onCreate?: (session: Stripe.Checkout.Session) => Promise<void>) {
  const concert = await addConcert()
  const group = await db.concertGroup.create({ data: { name: 'Test group', stripePriceId: config.priceId, salesEnabled: true, concerts: { connect: { id: concert.id } } } })
  groups.push(group.id)
  const userId = randomUUID()
  users.push(userId)
  const sessions = new Map<string, Stripe.Checkout.Session>()
  const requests = new Map<string, Stripe.Checkout.SessionCreateParams>()
  const prices = new Map([[config.priceId, { active: true, type: 'one_time', unit_amount: 4000, currency: 'eur' }]])
  const stripe = { prices: { retrieve: async (id: string) => {
    const price = prices.get(id)
    if (!price) throw new Error('Unknown price')
    return price
  } }, checkout: { sessions: {
    retrieve: async (id: string) => {
      const session = [...sessions.values()].find(s => s.id === id)
      if (!session) throw new Error('Unknown session')
      return session
    },
    create: async (params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => {
      const key = options.idempotencyKey!
      if (requests.has(key)) assert.deepEqual(params, requests.get(key), "Stripe idempotency requires identical parameters")
      requests.set(key, params)
      let session = sessions.get(key)
      if (!session) {
        const price = prices.get(params.line_items?.[0].price || '')
        assert.ok(price?.active)
        assert.match(params.success_url || '', /^https:\/\/festival\.example\/(en|sl)\/concerts\//)
        session = { id: `cs_${randomUUID()}`, status: 'open', mode: 'payment', payment_status: 'unpaid', amount_total: price.unit_amount, currency: price.currency, url: 'https://checkout.stripe.com/test', metadata: params.metadata } as Stripe.Checkout.Session
        sessions.set(key, session)
      }
      await onCreate?.(session)
      return session
    },
  } } } as unknown as Stripe
  return { group, concert, userId, sessions, requests, prices, stripe, input: { userId, groupId: group.id, concertId: concert.id, locale: 'en', appUrl: 'https://festival.example' } }
}
function settled(session: Stripe.Checkout.Session): Stripe.Checkout.Session {
  return { ...session, status: 'complete', payment_status: 'paid' }
}
async function buy(f: Awaited<ReturnType<typeof fixture>>) {
  await createFestivalCheckout(db, f.stripe, f.input)
  const session = [...f.sessions.values()][0]
  await fulfillCheckout(db, settled(session))
  return session
}

test('parallel pass checkouts create one order and one Stripe attempt', async () => {
  const f = await fixture()
  const results = await Promise.all(Array.from({ length: 8 }, () => createFestivalCheckout(db, f.stripe, f.input)))
  assert.equal(f.sessions.size, 1)
  assert.equal(new Set(results.map(r => 'id' in r ? r.id : '')).size, 1)
  assert.equal(await db.festivalPass.count({ where: { userId: f.userId } }), 1)
})

test('concurrent fulfillment unlocks selected concerts, including later additions, and preserves single tickets', async () => {
  const f = await fixture()
  const ticket = await db.ticket.create({ data: { userId: f.userId, concertId: f.concert.id, status: 'paid', amountCents: 1200 } })
  await createFestivalCheckout(db, f.stripe, f.input)
  const session = [...f.sessions.values()][0]
  await Promise.all(Array.from({ length: 8 }, () => fulfillCheckout(db, settled(session))))
  const later = await addConcert('2090-11-15T18:00:00Z')
  const nextYear = await addConcert('2091-10-11T18:00:00Z')
  const previousYear = await addConcert('2089-10-11T18:00:00Z')
  assert.equal(await hasConcertAccess(db, f.userId, later), false)
  await db.concertGroup.update({ where: { id: f.group.id }, data: { concerts: { connect: [{ id: later.id }, { id: nextYear.id }] } } })
  assert.equal(await hasConcertAccess(db, f.userId, later), true)
  assert.equal(await hasConcertAccess(db, f.userId, nextYear), true)
  assert.equal(await hasConcertAccess(db, f.userId, previousYear), false)
  assert.equal(await hasConcertAccess(db, 'another-user', later), false)
  assert.deepEqual(await db.ticket.findUnique({ where: { id: ticket.id } }), ticket)
  assert.equal(await db.ticket.count({ where: { userId: f.userId } }), 1)
  assert.equal((await db.festivalPass.findFirstOrThrow({ where: { userId: f.userId } })).amountCents, 4000)
})

test('unpaid completion gives no access; paid and fully discounted confirmations do', async () => {
  for (const free of [false, true]) {
    const f = await fixture()
    await createFestivalCheckout(db, f.stripe, f.input)
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
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input), { alreadyOwned: true })
})

test('open sessions are reused, delayed payments block retries, and failed attempts can restart', async () => {
  const f = await fixture()
  const first = await createFestivalCheckout(db, f.stripe, f.input)
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input), first)
  const session = [...f.sessions.values()][0]
  session.status = 'complete'
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input), /still being processed/)
  await closeUnpaidCheckout(db, session, 'failed')
  await createFestivalCheckout(db, f.stripe, f.input)
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
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input), /contact support/)
})

test('fulfillment requires matching server-created order metadata', async () => {
  const f = await fixture()
  await createFestivalCheckout(db, f.stripe, f.input)
  const session = settled([...f.sessions.values()][0])
  for (const override of [{ userId: 'someone-else' }, { groupId: 'another-group' }, { priceId: 'price_wrong' }, { passId: 'missing' }] as Record<string, string>[]) {
    assert.equal(await fulfillCheckout(db, { ...session, metadata: { ...session.metadata, ...override } }), false)
  }
  assert.equal(await hasConcertAccess(db, f.userId, f.concert), false)
})

test('pass owners cannot start another pass or individual ticket checkout', async () => {
  const f = await fixture()
  await buy(f)
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input), { alreadyOwned: true })
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
  await db.concertGroup.update({ where: { id: f.group.id }, data: { concerts: { connect: [{ id: later.id }, { id: hidden.id }] } } })
  const result = await listPurchasedConcerts(db, f.userId, 'en', 'upcoming')
  assert.equal(result.items.filter(i => i.concertId === f.concert.id).length, 1)
  assert.equal(result.items.find(i => i.concertId === f.concert.id)?.amountCents, 1200)
  assert.equal(result.items.find(i => i.concertId === later.id)?.passName, 'Test group')
  assert.equal(result.items.some(i => [hidden.id, next.id].includes(i.concertId)), false)
  assert.equal(result.passes.length, 1)
  assert.equal(result.passes[0].amountCents, 4000)
})

test('disabled sales and unselected concerts cannot create pass orders', async () => {
  const f = await fixture()
  const other = await addConcert()
  await assert.rejects(createFestivalCheckout(db, f.stripe, { ...f.input, concertId: other.id }), /not included/)
  await db.concertGroup.update({ where: { id: f.group.id }, data: { salesEnabled: false } })
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input), /unavailable/)
  assert.equal(await db.festivalPass.count({ where: { userId: f.userId } }), 0)
})

test('group edits preserve purchased membership, allow additions, and disabled sales preserve access', async () => {
  const f = await fixture()
  await buy(f)
  const later = await addConcert()
  const input = { name: f.group.name, stripePriceId: config.priceId, salesEnabled: false, concertIds: [later.id] }
  await assert.rejects(saveConcertGroup(db, input, f.group.id), /cannot be removed/)
  await saveConcertGroup(db, { ...input, concertIds: [f.concert.id, later.id] }, f.group.id)
  assert.equal(await hasConcertAccess(db, f.userId, f.concert), true)
  assert.equal(await hasConcertAccess(db, f.userId, later), true)
})

test('overlapping group passes appear only once per concert in the dashboard', async () => {
  const f = await fixture()
  await buy(f)
  const group = await db.concertGroup.create({ data: { name: 'Second group', concerts: { connect: { id: f.concert.id } } } })
  groups.push(group.id)
  await db.festivalPass.create({ data: { userId: f.userId, groupId: group.id, status: 'paid', stripePriceId: 'price_other' } })
  const result = await listPurchasedConcerts(db, f.userId, 'en', 'upcoming')
  assert.equal(result.items.filter(i => i.concertId === f.concert.id).length, 1)
  assert.equal(result.passes.length, 2)
})

test('draft groups allow removing concerts and reject unknown concert IDs', async () => {
  const f = await fixture()
  const input = { name: 'Draft', stripePriceId: null, salesEnabled: false, concertIds: [] as string[] }
  await saveConcertGroup(db, input, f.group.id)
  assert.equal((await db.concertGroup.findUniqueOrThrow({ where: { id: f.group.id }, include: { concerts: true } })).concerts.length, 0)
  await assert.rejects(saveConcertGroup(db, { ...input, concertIds: ['missing'] }, f.group.id), /no longer exist/)
})

test('checkout from different included concerts shares stable Stripe parameters', async () => {
  const f = await fixture()
  const other = await addConcert()
  await db.concertGroup.update({ where: { id: f.group.id }, data: { concerts: { connect: { id: other.id } } } })
  await Promise.all([
    createFestivalCheckout(db, f.stripe, f.input),
    createFestivalCheckout(db, f.stripe, { ...f.input, concertId: other.id, locale: 'sl' }),
  ])
  assert.equal(f.sessions.size, 1)
})

test('pending orders prevent membership removal and still settle after sales are disabled', async () => {
  const f = await fixture()
  await createFestivalCheckout(db, f.stripe, f.input)
  await assert.rejects(saveConcertGroup(db, { name: 'Changed', salesEnabled: false, stripePriceId: null, concertIds: [] }, f.group.id), /cannot be removed/)
  await saveConcertGroup(db, { name: 'Changed', salesEnabled: false, stripePriceId: null, concertIds: [f.concert.id] }, f.group.id)
  await fulfillCheckout(db, settled([...f.sessions.values()][0]))
  assert.equal(await hasConcertAccess(db, f.userId, f.concert), true)
})

test('legacy year metadata can settle only an existing migrated order', async () => {
  const f = await fixture()
  await createFestivalCheckout(db, f.stripe, f.input)
  const session = settled([...f.sessions.values()][0])
  const legacy = { ...session, metadata: { purchaseType: 'festivalPass', userId: f.userId, passId: session.metadata!.passId, priceId: config.priceId, year: '2026' } }
  assert.equal(await fulfillCheckout(db, legacy), false)
  await db.festivalPass.updateMany({ where: { userId: f.userId }, data: { year: 2026 } })
  assert.equal(await fulfillCheckout(db, legacy), true)
  assert.equal(await hasConcertAccess(db, f.userId, f.concert), true)
})

test('expired and failed checkouts retry at the current group price even when the old price is inactive', async () => {
  for (const status of ['expired', 'failed'] as const) {
    const f = await fixture()
    await createFestivalCheckout(db, f.stripe, f.input)
    const previous = [...f.sessions.values()][0]
    previous.status = status === 'expired' ? 'expired' : 'complete'
    await closeUnpaidCheckout(db, previous, status)
    f.prices.get(config.priceId)!.active = false
    f.prices.set('price_new', { active: true, type: 'one_time', unit_amount: 5000, currency: 'eur' })
    await saveConcertGroup(db, { name: f.group.name, salesEnabled: true, stripePriceId: 'price_new', concertIds: [f.concert.id] }, f.group.id)
    const pass = await db.festivalPass.findFirstOrThrow({ where: { userId: f.userId } })
    assert.equal(await festivalOfferPriceId(f.stripe, 'price_new', pass), 'price_new')

    const results = await Promise.all(Array.from({ length: 8 }, () => createFestivalCheckout(db, f.stripe, f.input)))
    assert.equal(f.sessions.size, 2)
    assert.equal(new Set(results.map(r => 'id' in r ? r.id : '')).size, 1)
    assert.equal([...f.requests.values()][1].line_items?.[0].price, 'price_new')
    const next = [...f.sessions.values()][1]
    await fulfillCheckout(db, settled(next))
    const paid = await db.festivalPass.findUniqueOrThrow({ where: { id: pass.id } })
    assert.equal(paid.status, 'paid')
    assert.equal(paid.amountCents, 5000)
    assert.equal(paid.checkoutAttempt, 1)
  }
})

test('price changes preserve open checkouts and do not restart processing payments', async () => {
  const f = await fixture()
  const first = await createFestivalCheckout(db, f.stripe, f.input)
  f.prices.set('price_new', { active: true, type: 'one_time', unit_amount: 5000, currency: 'eur' })
  await saveConcertGroup(db, { name: f.group.name, salesEnabled: true, stripePriceId: 'price_new', concertIds: [f.concert.id] }, f.group.id)
  const pass = await db.festivalPass.findFirstOrThrow({ where: { userId: f.userId } })
  assert.equal(await festivalOfferPriceId(f.stripe, 'price_new', pass), config.priceId)
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input), first)
  const session = [...f.sessions.values()][0]
  session.status = 'complete'
  assert.equal(await festivalOfferPriceId(f.stripe, 'price_new', pass), config.priceId)
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input), /still being processed/)
  assert.equal(f.sessions.size, 1)
  await fulfillCheckout(db, settled(session))
  assert.equal((await db.festivalPass.findUniqueOrThrow({ where: { id: pass.id } })).amountCents, 4000)
})

test('concurrent retries choose one visible return concert after the original concert is archived', async () => {
  const f = await fixture()
  await createFestivalCheckout(db, f.stripe, f.input)
  const previous = [...f.sessions.values()][0]
  previous.status = 'expired'
  // The expired webhook need not have arrived before the customer retries.
  const second = await addConcert()
  const third = await addConcert()
  await saveConcertGroup(db, { name: f.group.name, salesEnabled: true, stripePriceId: config.priceId, concertIds: [f.concert.id, second.id, third.id] }, f.group.id)
  await db.concert.update({ where: { id: f.concert.id }, data: { isVisible: false } })
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => createFestivalCheckout(db, f.stripe, {
    ...f.input, concertId: i % 2 ? second.id : third.id, locale: i % 2 ? 'en' : 'sl',
  })))
  assert.equal(f.sessions.size, 2)
  assert.equal(new Set(results.map(r => 'id' in r ? r.id : '')).size, 1)
  const params = [...f.requests.values()][1]
  const path = new URL(params.success_url!).pathname
  assert.ok([`/en/concerts/${second.id}`, `/sl/concerts/${third.id}`].includes(path))
  assert.equal(new URL(params.cancel_url!).pathname, path)
  const next = [...f.sessions.values()][1]
  await closeUnpaidCheckout(db, previous, 'expired')
  // A stale confirmation from the previous attempt must not fulfill this attempt, even at the same price.
  assert.equal(await fulfillCheckout(db, settled(previous)), false)
  assert.equal(await hasConcertAccess(db, f.userId, second), false)
  await fulfillCheckout(db, settled(next))
  assert.equal(await hasConcertAccess(db, f.userId, second), true)
})

test('a lost retry response recovers the same Stripe attempt after another price and locale change', async () => {
  let loseResponse = false
  const f = await fixture(async () => {
    if (loseResponse) { loseResponse = false; throw new Error('Connection lost after Stripe created checkout') }
  })
  await createFestivalCheckout(db, f.stripe, f.input)
  const previous = [...f.sessions.values()][0]
  previous.status = 'expired'
  f.prices.set('price_new', { active: true, type: 'one_time', unit_amount: 5000, currency: 'eur' })
  f.prices.set('price_later', { active: true, type: 'one_time', unit_amount: 6000, currency: 'eur' })
  await saveConcertGroup(db, { name: f.group.name, salesEnabled: true, stripePriceId: 'price_new', concertIds: [f.concert.id] }, f.group.id)
  loseResponse = true
  await assert.rejects(createFestivalCheckout(db, f.stripe, f.input), /Connection lost/)
  const pending = await db.festivalPass.findFirstOrThrow({ where: { userId: f.userId } })
  assert.equal(pending.stripeCheckoutSessionId, null)
  await saveConcertGroup(db, { name: f.group.name, salesEnabled: true, stripePriceId: 'price_later', concertIds: [f.concert.id] }, f.group.id)
  assert.equal(await festivalOfferPriceId(f.stripe, 'price_later', pending), 'price_new')
  const recovered = await createFestivalCheckout(db, f.stripe, { ...f.input, locale: 'sl' })
  assert.equal(f.sessions.size, 2)
  assert.equal('id' in recovered && recovered.id, [...f.sessions.values()][1].id)
  assert.equal([...f.requests.values()][1].line_items?.[0].price, 'price_new')
})

test('settlement during retry preparation prevents a new attempt', async () => {
  const f = await fixture()
  await createFestivalCheckout(db, f.stripe, f.input)
  const previous = [...f.sessions.values()][0]
  f.stripe.checkout.sessions.retrieve = (async () => {
    await fulfillCheckout(db, settled(previous))
    return { ...previous, status: 'expired' }
  }) as unknown as typeof f.stripe.checkout.sessions.retrieve
  assert.deepEqual(await createFestivalCheckout(db, f.stripe, f.input), { alreadyOwned: true })
  assert.equal(f.sessions.size, 1)
})
