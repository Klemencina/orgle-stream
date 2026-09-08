import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import type { PrismaClient } from '@prisma/client'
import { CheckoutError } from './checkout'
import { fulfillCheckout, isSettledCheckout } from './tickets'
import { festivalDates, festivalYear } from './festival-pass'
import { VIEWING_DURATION_MS } from './viewing-window'

export async function createFestivalCheckout(db: PrismaClient, stripe: Stripe, input: {
  userId: string; concertId: string; locale: string; appUrl: string
}, config: { year: number; priceId: string } | null) {
  if (!config) throw new CheckoutError('Festival pass sales are not configured', 404)
  const { userId, concertId, locale, appUrl } = input
  const concert = await db.concert.findUnique({ where: { id: concertId } })
  if (!concert?.isVisible || festivalYear(concert.date) !== config.year) throw new CheckoutError('Concert is not included in this festival pass', 400)
  const remaining = await db.concert.findFirst({ where: {
    isVisible: true, AND: [{ date: festivalDates(config.year) }, { date: { gte: new Date(Date.now() - VIEWING_DURATION_MS) } }],
  }, select: { id: true } })
  if (!remaining) throw new CheckoutError('Festival pass sales have ended')
  // A previously started order keeps its price so a price change cannot rewrite an in-flight purchase.
  const pass = await db.festivalPass.upsert({
    where: { userId_year: { userId, year: config.year } },
    create: { userId, year: config.year, status: 'pending', stripePriceId: config.priceId }, update: { userId },
  })
  if (pass.status === 'paid') return { alreadyOwned: true }
  if (!['pending', 'failed', 'expired'].includes(pass.status)) throw new CheckoutError('Please contact support about this pass', 409)
  if (pass.stripeCheckoutSessionId) {
    const previous = await stripe.checkout.sessions.retrieve(pass.stripeCheckoutSessionId)
    if (previous.metadata?.userId !== userId || previous.metadata?.passId !== pass.id || previous.metadata?.purchaseType !== 'festivalPass') {
      throw new CheckoutError('Please contact support about this pass', 409)
    }
    if (isSettledCheckout(previous)) {
      await fulfillCheckout(db, previous)
      const current = await db.festivalPass.findUniqueOrThrow({ where: { id: pass.id } })
      if (current.status === 'paid') return { alreadyOwned: true }
      throw new CheckoutError('Please contact support about this pass', 409)
    }
    if (previous.status === 'open' && previous.url) return { id: previous.id, url: previous.url }
    if (previous.status !== 'expired' && pass.status !== 'failed') throw new CheckoutError('Your payment is still being processed. Please wait before trying again.', 409)
  }
  if (pass.stripePriceId !== config.priceId) throw new CheckoutError('The pass price has changed. Please contact support before purchasing.', 409)
  const price = await stripe.prices.retrieve(pass.stripePriceId)
  if (!price.active || price.type !== 'one_time' || price.unit_amount == null) throw new CheckoutError('Festival pass is not purchasable yet')
  const key = createHash('sha256').update(`${pass.id}:${pass.stripeCheckoutSessionId || 'initial'}`).digest('hex')
  const base = `${new URL(appUrl).origin}/${locale}/concerts/${encodeURIComponent(concertId)}`
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', line_items: [{ price: pass.stripePriceId, quantity: 1 }], allow_promotion_codes: true,
    success_url: `${base}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}?checkout=cancel`,
    metadata: { purchaseType: 'festivalPass', passId: pass.id, year: String(pass.year), priceId: pass.stripePriceId, userId },
  }, { idempotencyKey: `festival-${key}` })
  await db.festivalPass.updateMany({
    where: { id: pass.id, status: { in: ['pending', 'failed', 'expired'] }, stripeCheckoutSessionId: pass.stripeCheckoutSessionId },
    data: { stripeCheckoutSessionId: session.id, status: 'pending' },
  })
  const current = await db.festivalPass.findUniqueOrThrow({ where: { id: pass.id } })
  if (current.status === 'paid') return { alreadyOwned: true }
  return { id: session.id, url: session.url }
}
