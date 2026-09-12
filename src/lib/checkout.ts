import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import type { PrismaClient } from '@prisma/client'
import { fulfillCheckout, isSettledCheckout } from './tickets'
import { hasFestivalPass } from './festival-pass'

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export async function createCheckout(db: PrismaClient, stripe: Stripe, input: {
  userId: string; concertId: string; locale: string; appUrl: string
}) {
  const { userId, concertId, locale, appUrl } = input
  const concert = await db.concert.findUnique({ where: { id: concertId } })
  if (!concert || !concert.isVisible) throw new CheckoutError('Concert not found', 404)
  if (Date.now() > concert.date.getTime() + 3 * 60 * 60 * 1000) {
    throw new CheckoutError('Ticket sales for this concert have ended')
  }
  if (await hasFestivalPass(db, userId, concert.id)) return { alreadyOwned: true }
  if (!concert.stripePriceId) throw new CheckoutError('Concert is not purchasable yet')

  const ticket = await db.ticket.upsert({
    where: { userId_concertId: { userId, concertId } },
    create: { userId, concertId, amountCents: 0, currency: 'eur', status: 'pending' },
    update: { userId },
  })
  if (ticket.status === 'paid') return { alreadyOwned: true }
  if (!['pending', 'failed', 'expired'].includes(ticket.status)) {
    throw new CheckoutError('Please contact support about this ticket', 409)
  }

  if (ticket.stripeCheckoutSessionId) {
    const previous = await stripe.checkout.sessions.retrieve(ticket.stripeCheckoutSessionId)
    if (previous.metadata?.userId !== userId || previous.metadata?.concertId !== concertId) {
      throw new CheckoutError('Please contact support about this ticket', 409)
    }
    if (isSettledCheckout(previous)) {
      await fulfillCheckout(db, previous)
      const current = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
      if (current.status === 'paid') return { alreadyOwned: true }
      throw new CheckoutError('Please contact support about this ticket', 409)
    }
    if (previous.status === 'open' && previous.url) return { id: previous.id, url: previous.url }
    if (previous.status !== 'expired' && ticket.status !== 'failed') {
      throw new CheckoutError('Your payment is still being processed. Please wait before trying again.', 409)
    }
  }

  // All concurrent requests for this purchase attempt use the same Stripe key.
  const attemptKey = createHash('sha256').update(`${ticket.id}:${ticket.stripeCheckoutSessionId || 'initial'}`).digest('hex')
  const base = `${new URL(appUrl).origin}/${locale}/concerts/${encodeURIComponent(concertId)}`
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: concert.stripePriceId, quantity: 1 }],
    success_url: `${base}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}?checkout=cancel`,
    allow_promotion_codes: true,
    metadata: { concertId, userId, productId: concert.stripeProductId || '' },
  }, { idempotencyKey: `concert-${attemptKey}` })

  // A webhook may already have fulfilled the ticket while Stripe was responding.
  await db.ticket.updateMany({
    where: {
      id: ticket.id,
      status: { in: ['pending', 'failed', 'expired'] },
      stripeCheckoutSessionId: ticket.stripeCheckoutSessionId,
    },
    data: { stripeCheckoutSessionId: session.id, status: 'pending' },
  })
  const current = await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
  if (current.status === 'paid') return { alreadyOwned: true }
  return { id: session.id, url: session.url }
}
