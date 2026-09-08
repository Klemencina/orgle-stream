import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { closeUnpaidCheckout, fulfillCheckout } from '../src/lib/tickets'
import { createCheckout } from '../src/lib/checkout'
import { archiveConcert, replaceConcertDetails } from '../src/lib/concerts'

const url = new URL(process.env.TEST_DATABASE_URL || 'file:///missing')
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/orgle_test') {
  throw new Error('Tests require TEST_DATABASE_URL pointing to a local orgle_test database')
}
const db = new PrismaClient({ datasourceUrl: url.toString() })
const ids: string[] = []
after(async () => {
  await db.concert.deleteMany({ where: { id: { in: ids } } })
  await db.$disconnect()
})

async function fixture() {
  const concertId = randomUUID()
  const userId = randomUUID()
  await db.concert.create({ data: {
    id: concertId, date: new Date(Date.now() + 86400000), stripePriceId: 'price_test',
    translations: { create: { locale: 'sl', title: 'Test concert', venue: 'Test venue', description: '' } },
    program: { create: { order: 0, translations: { create: { locale: 'sl', title: 'Original piece', composer: 'Composer', subtitles: ['Movement'] } } } },
  } })
  ids.push(concertId)
  const session = { id: `cs_${randomUUID()}`, mode: 'payment', status: 'complete', payment_status: 'paid',
    amount_total: 1000, currency: 'eur', payment_intent: `pi_${randomUUID()}`, metadata: { userId, concertId },
  } as unknown as Stripe.Checkout.Session
  return { concertId, userId, session, input: { concertId, userId, locale: 'sl', appUrl: 'https://festival.example' } }
}

test('concurrent webhook deliveries produce one paid ticket', async () => {
  const f = await fixture()
  await Promise.all(Array.from({ length: 8 }, () => fulfillCheckout(db, f.session)))
  const tickets = await db.ticket.findMany({ where: { concertId: f.concertId } })
  assert.equal(tickets.length, 1)
  assert.equal(tickets[0].status, 'paid')
  assert.equal(tickets[0].amountCents, 1000)
})

test('unpaid completion creates no ticket; later settlement grants access', async () => {
  const f = await fixture()
  await fulfillCheckout(db, { ...f.session, payment_status: 'unpaid' })
  assert.equal(await db.ticket.count({ where: { concertId: f.concertId } }), 0)
  await fulfillCheckout(db, f.session)
  assert.equal((await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } })).status, 'paid')
})

test('replayed settlement does not restore a refunded ticket or overwrite its amount', async () => {
  const f = await fixture()
  await fulfillCheckout(db, f.session)
  await db.ticket.updateMany({ where: { concertId: f.concertId }, data: { status: 'refunded' } })
  await fulfillCheckout(db, { ...f.session, amount_total: 0 })
  const ticket = await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } })
  assert.equal(ticket.status, 'refunded')
  assert.equal(ticket.amountCents, 1000)
})

test('fully discounted checkout records zero rather than a stale amount', async () => {
  const f = await fixture()
  await db.ticket.create({ data: { userId: f.userId, concertId: f.concertId, status: 'pending', amountCents: 1000 } })
  await fulfillCheckout(db, { ...f.session, amount_total: 0, payment_status: 'no_payment_required' })
  assert.equal((await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } })).amountCents, 0)
})

test('late failure or expiry cannot revoke a paid ticket', async () => {
  const f = await fixture()
  await fulfillCheckout(db, f.session)
  await closeUnpaidCheckout(db, f.session, 'failed')
  await closeUnpaidCheckout(db, f.session, 'expired')
  assert.equal((await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } })).status, 'paid')
})

function stripeStub(onCreate?: (session: Stripe.Checkout.Session) => Promise<void>) {
  const sessions = new Map<string, Stripe.Checkout.Session>()
  const keys = new Set<string>()
  const stripe = { checkout: { sessions: {
    retrieve: async (id: string) => {
      const session = [...sessions.values()].find(s => s.id === id)
      if (!session) throw new Error('Unknown test session')
      return session
    },
    create: async (params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => {
      const key = options.idempotencyKey!
      keys.add(key)
      let session = sessions.get(key)
      if (!session) {
        session = { id: `cs_${randomUUID()}`, status: 'open', mode: 'payment', payment_status: 'unpaid',
          url: 'https://checkout.stripe.com/test', amount_total: 1000, currency: 'eur', metadata: params.metadata,
        } as Stripe.Checkout.Session
        sessions.set(key, session)
      }
      await onCreate?.(session)
      return session
    },
  } } } as unknown as Stripe
  return { stripe, sessions, keys }
}

test('parallel checkout requests reuse one Stripe attempt and one ticket', async () => {
  const f = await fixture()
  const stub = stripeStub()
  const results = await Promise.all(Array.from({ length: 8 }, () => createCheckout(db, stub.stripe, f.input)))
  assert.equal(stub.keys.size, 1)
  assert.equal(new Set(results.map(result => 'id' in result ? result.id : null)).size, 1)
  assert.equal(await db.ticket.count({ where: { concertId: f.concertId } }), 1)
})

test('a webhook during checkout creation cannot be overwritten with pending', async () => {
  const f = await fixture()
  const stub = stripeStub(async session => {
    await fulfillCheckout(db, { ...session, status: 'complete', payment_status: 'paid' })
  })
  assert.deepEqual(await createCheckout(db, stub.stripe, f.input), { alreadyOwned: true })
  assert.equal((await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } })).status, 'paid')
})

test('open checkout is reused and expired checkout starts a new attempt', async () => {
  const f = await fixture()
  const stub = stripeStub()
  const first = await createCheckout(db, stub.stripe, f.input)
  assert.deepEqual(await createCheckout(db, stub.stripe, f.input), first)
  assert.equal(stub.keys.size, 1)
  for (const session of stub.sessions.values()) session.status = 'expired'
  const second = await createCheckout(db, stub.stripe, f.input)
  assert.notDeepEqual(second, first)
  assert.equal(stub.keys.size, 2)
})

test('a delayed payment blocks another checkout instead of charging twice', async () => {
  const f = await fixture()
  const stub = stripeStub()
  await createCheckout(db, stub.stripe, f.input)
  for (const session of stub.sessions.values()) session.status = 'complete'
  await assert.rejects(createCheckout(db, stub.stripe, f.input), /still being processed/)
  assert.equal(stub.keys.size, 1)
})

test('a confirmed delayed-payment failure permits a new checkout attempt', async () => {
  const f = await fixture()
  const stub = stripeStub()
  await createCheckout(db, stub.stripe, f.input)
  const session = [...stub.sessions.values()][0]
  session.status = 'complete'
  await closeUnpaidCheckout(db, session, 'failed')
  await createCheckout(db, stub.stripe, f.input)
  assert.equal(stub.keys.size, 2)
  await closeUnpaidCheckout(db, session, 'failed')
  assert.equal((await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } })).status, 'pending')
})

test('checkout refuses a stored session belonging to a different user', async () => {
  const f = await fixture()
  const stub = stripeStub()
  await createCheckout(db, stub.stripe, f.input)
  const session = [...stub.sessions.values()][0]
  session.metadata = { ...session.metadata, userId: 'another-user' }
  await assert.rejects(createCheckout(db, stub.stripe, f.input), /contact support/)
})

test('ended concerts cannot sell tickets', async () => {
  const f = await fixture()
  await db.concert.update({ where: { id: f.concertId }, data: { date: new Date(0) } })
  const stub = stripeStub()
  await assert.rejects(createCheckout(db, stub.stripe, f.input), /have ended/)
  assert.equal(stub.keys.size, 0)
})

test('a failed concert edit restores the original program and translations', async () => {
  const f = await fixture()
  const before = await db.concert.findUniqueOrThrow({ where: { id: f.concertId }, include: { translations: true, program: { include: { translations: true } } } })
  await assert.rejects(replaceConcertDetails(db, f.concertId, tx => tx.concert.update({
    where: { id: f.concertId }, data: { translations: { create: [
      { locale: 'sl', title: 'Duplicate one', venue: '', description: '' },
      { locale: 'sl', title: 'Duplicate two', venue: '', description: '' },
    ] } },
  })))
  const after = await db.concert.findUniqueOrThrow({ where: { id: f.concertId }, include: { translations: true, program: { include: { translations: true } } } })
  assert.deepEqual(after, before)
})

test('a successful concert edit replaces details and preserves its ticket', async () => {
  const f = await fixture()
  await fulfillCheckout(db, f.session)
  const ticket = await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } })
  await replaceConcertDetails(db, f.concertId, tx => tx.concert.update({
    where: { id: f.concertId }, data: {
      translations: { create: { locale: 'sl', title: 'Revised concert', venue: 'New venue', description: '' } },
      program: { create: { order: 0, translations: { create: { locale: 'sl', title: 'Revised piece', composer: 'Composer', subtitles: [] } } } },
    },
  }))
  assert.equal((await db.concertTranslation.findFirstOrThrow({ where: { concertId: f.concertId } })).title, 'Revised concert')
  assert.equal(await db.programPiece.count({ where: { concertId: f.concertId } }), 1)
  assert.deepEqual(await db.ticket.findFirstOrThrow({ where: { concertId: f.concertId } }), ticket)
})

test('archiving hides the concert and preserves its program and purchased tickets', async () => {
  const f = await fixture()
  await fulfillCheckout(db, f.session)
  const before = await db.concert.findUniqueOrThrow({ where: { id: f.concertId }, include: { translations: true, tickets: true, program: { include: { translations: true } } } })
  await archiveConcert(db, f.concertId)
  const after = await db.concert.findUniqueOrThrow({ where: { id: f.concertId }, include: { translations: true, tickets: true, program: { include: { translations: true } } } })
  assert.equal(after.isVisible, false)
  assert.deepEqual(after.program, before.program)
  assert.deepEqual(after.translations, before.translations)
  assert.deepEqual(after.tickets, before.tickets)
})
