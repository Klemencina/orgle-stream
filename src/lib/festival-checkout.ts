import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import type { FestivalPass, Prisma, PrismaClient } from '@prisma/client'
import { CheckoutError } from './checkout'
import { fulfillCheckout, isSettledCheckout } from './tickets'
import { VIEWING_DURATION_MS } from './viewing-window'

type CheckoutInput = {
  userId: string; concertId: string; groupId: string; locale: string; appUrl: string
}

async function availableGroup(tx: Prisma.TransactionClient, groupId: string, concertId: string) {
  // Group edits take the same lock, so checkout cannot race a membership removal.
  await tx.$queryRaw`SELECT id FROM concert_groups WHERE id = ${groupId} FOR UPDATE`
  const group = await tx.concertGroup.findUnique({ where: { id: groupId }, include: { concerts: true } })
  if (!group?.salesEnabled || !group.stripePriceId) throw new CheckoutError('Group pass sales are unavailable', 404)
  if (!group.concerts.some(c => c.id === concertId && c.isVisible)) throw new CheckoutError('Concert is not included in this pass')
  if (!group.concerts.some(c => c.isVisible && c.date.getTime() + VIEWING_DURATION_MS >= Date.now())) {
    throw new CheckoutError('Group pass sales have ended')
  }
  return { ...group, stripePriceId: group.stripePriceId }
}

function verifySession(pass: FestivalPass, session: Stripe.Checkout.Session) {
  if (session.metadata?.userId !== pass.userId || session.metadata?.passId !== pass.id || session.metadata?.purchaseType !== 'festivalPass') {
    throw new CheckoutError('Please contact support about this pass', 409)
  }
}

function canRetry(session: Stripe.Checkout.Session, status: string) {
  return session.status === 'expired' || (session.status === 'complete' && status === 'failed' && !isSettledCheckout(session))
}

export async function festivalOfferPriceId(stripe: Stripe, groupPriceId: string, pass?: FestivalPass) {
  if (!pass) return groupPriceId
  if (!['pending', 'failed', 'expired'].includes(pass.status)) return null
  if (!pass.stripeCheckoutSessionId || pass.stripePriceId === groupPriceId) return pass.stripePriceId
  const session = await stripe.checkout.sessions.retrieve(pass.stripeCheckoutSessionId)
  verifySession(pass, session)
  return canRetry(session, pass.status) ? groupPriceId : pass.stripePriceId
}

export async function createFestivalCheckout(db: PrismaClient, stripe: Stripe, input: CheckoutInput) {
  const { userId, concertId, groupId, locale, appUrl } = input
  const checkoutPath = `/${locale}/concerts/${encodeURIComponent(concertId)}`
  let pass = await db.$transaction(async tx => {
    const group = await availableGroup(tx, groupId, concertId)
    return tx.festivalPass.upsert({
      where: { userId_groupId: { userId, groupId } },
      create: { userId, groupId, status: 'pending', stripePriceId: group.stripePriceId, checkoutPath }, update: { userId },
    })
  })
  while (true) {
    if (pass.status === 'paid') return { alreadyOwned: true }
    if (!['pending', 'failed', 'expired'].includes(pass.status)) throw new CheckoutError('Please contact support about this pass', 409)
    if (pass.stripeCheckoutSessionId) {
      const previous = await stripe.checkout.sessions.retrieve(pass.stripeCheckoutSessionId)
      verifySession(pass, previous)
      if (isSettledCheckout(previous)) {
        await fulfillCheckout(db, previous)
        const current = await db.festivalPass.findUniqueOrThrow({ where: { id: pass.id } })
        if (current.status === 'paid') return { alreadyOwned: true }
        throw new CheckoutError('Please contact support about this pass', 409)
      }
      if (previous.status === 'open' && previous.url) return { id: previous.id, url: previous.url }
      if (!canRetry(previous, pass.status)) throw new CheckoutError('Your payment is still being processed. Please wait before trying again.', 409)
      pass = await db.$transaction(async tx => {
        const group = await availableGroup(tx, groupId, concertId)
        // Reserve one attempt before calling Stripe. All retries reuse its price and return path.
        await tx.festivalPass.updateMany({
          where: { id: pass.id, checkoutAttempt: pass.checkoutAttempt, stripeCheckoutSessionId: previous.id, status: pass.status },
          data: {
            checkoutAttempt: { increment: 1 }, stripeCheckoutSessionId: null, status: 'pending',
            stripePriceId: group.stripePriceId, checkoutPath,
          },
        })
        return tx.festivalPass.findUniqueOrThrow({ where: { id: pass.id } })
      })
      continue
    }
    const price = await stripe.prices.retrieve(pass.stripePriceId)
    if (!price.active || price.type !== 'one_time' || price.unit_amount == null) throw new CheckoutError('Festival pass is not purchasable yet')
    const key = createHash('sha256').update(`${pass.id}:${pass.checkoutAttempt ? `attempt:${pass.checkoutAttempt}` : 'initial'}`).digest('hex')
    const base = `${new URL(appUrl).origin}${pass.checkoutPath || `/${locale}/concerts/${encodeURIComponent(concertId)}`}`
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', line_items: [{ price: pass.stripePriceId, quantity: 1 }], allow_promotion_codes: true,
      success_url: `${base}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}?checkout=cancel`,
      payment_intent_data: { metadata: { purchaseType: 'festivalPass', passId: pass.id, groupId: pass.groupId, userId } },
      metadata: {
        purchaseType: 'festivalPass', passId: pass.id, groupId: pass.groupId, priceId: pass.stripePriceId, userId,
        // Keep initial requests compatible with sessions created before attempt tracking.
        ...(pass.checkoutAttempt ? { attempt: String(pass.checkoutAttempt) } : {}),
      },
    }, { idempotencyKey: `festival-${key}` })
    await db.festivalPass.updateMany({
      where: { id: pass.id, checkoutAttempt: pass.checkoutAttempt, status: { in: ['pending', 'failed', 'expired'] }, stripeCheckoutSessionId: null },
      data: { stripeCheckoutSessionId: session.id, status: 'pending' },
    })
    const current = await db.festivalPass.findUniqueOrThrow({ where: { id: pass.id } })
    if (current.status === 'paid') return { alreadyOwned: true }
    return { id: session.id, url: session.url }
  }
}
