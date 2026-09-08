import type Stripe from 'stripe'
import type { PrismaClient } from '@prisma/client'

export function isSettledCheckout(session: Stripe.Checkout.Session) {
  return session.mode === 'payment' && session.status === 'complete' && (
    session.payment_status === 'paid' ||
    (session.payment_status === 'no_payment_required' && session.amount_total === 0)
  )
}

export async function fulfillCheckout(db: PrismaClient, session: Stripe.Checkout.Session) {
  if (session.metadata?.purchaseType === 'festivalPass') return fulfillFestivalPass(db, session)
  const { userId, concertId } = session.metadata || {}
  if (!userId || !concertId || !isSettledCheckout(session)) return false

  const paymentIntent = session.payment_intent
  const stripePaymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id
  await db.$transaction(async (tx) => {
    await tx.ticket.upsert({
      where: { userId_concertId: { userId, concertId } },
      create: { userId, concertId, amountCents: 0, currency: session.currency || 'eur', status: 'pending' },
      update: { userId },
    })
    // A retry must not overwrite a paid ticket or restore revoked access.
    await tx.ticket.updateMany({
      where: { userId, concertId, status: { in: ['pending', 'failed', 'expired'] } },
      data: {
        status: 'paid',
        amountCents: session.amount_total ?? 0,
        currency: session.currency || 'eur',
        stripePaymentIntentId,
        stripeCheckoutSessionId: session.id,
      },
    })
  })
  return true
}

export async function closeUnpaidCheckout(db: PrismaClient, session: Stripe.Checkout.Session, status: 'failed' | 'expired') {
  if (session.metadata?.purchaseType === 'festivalPass') {
    await db.festivalPass.updateMany({ where: { stripeCheckoutSessionId: session.id, status: 'pending' }, data: { status } })
    return
  }
  await db.ticket.updateMany({
    where: { stripeCheckoutSessionId: session.id, status: 'pending' },
    data: { status },
  })
}

async function fulfillFestivalPass(db: PrismaClient, session: Stripe.Checkout.Session) {
  const { userId, passId, year, priceId } = session.metadata || {}
  if (!userId || !passId || !year || !priceId || !isSettledCheckout(session)) return false
  // Only fulfill an order created by our checkout, even after sales configuration changes.
  const pass = await db.festivalPass.findUnique({ where: { id: passId } })
  if (!pass || pass.userId !== userId || String(pass.year) !== year || pass.stripePriceId !== priceId) return false
  const paymentIntent = session.payment_intent
  await db.festivalPass.updateMany({
    where: { id: passId, status: { in: ['pending', 'failed', 'expired'] } },
    data: {
      status: 'paid', amountCents: session.amount_total ?? 0, currency: session.currency || 'eur',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id,
    },
  })
  return true
}
